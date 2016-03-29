import { Approval, Autobranch } from '../checks'
import { logger } from '../../common/debug'
import { checkHandler } from './CheckHandler'
import { repositoryHandler } from './RepositoryHandler'
import { pullRequestHandler } from './PullRequestHandler'
import { getCheckByType } from '../checks'
import nconf from '../nconf'
import GithubService from '../service/GithubService'

const info = logger('hook', 'info')
const DEFAULT_CONFIG = nconf.get('ZAPPR_DEFAULT_CONFIG')

function findHookEventsFor(types) {
  return types
          .map(getCheckByType)
          .map(c => c.hookEvents)
          // flatten
          .reduce((arr, evts) => {
            Array.prototype.push.apply(arr, evts)
            return arr
          }, [])
          // deduplicate
          .filter((evt, i, arr) => i === arr.lastIndexOf(evt))
}

class HookHandler {
  constructor(github = new GithubService()) {
    this.github = github
  }

  async onEnableCheck(user, repository, type) {
    const repo = repository.get('json')
    const types = repository.checks.map(c => c.type)
    types.push(type)
    const evts = findHookEventsFor(types)

    await this.github.updateWebhookFor(repo.owner.login, repo.name, evts, user.accessToken)
    await checkHandler.onCreateCheck(repo.id, type, user.accessToken)
    info(`${repo.full_name}: enabled check ${type}`)
  }

  async onDisableCheck(user, repository, type) {
    const repo = repository.get('json')
    const types = repository.checks.map(c => c.type).filter(t => t !== type)
    const evts = findHookEventsFor(types)

    await this.github.updateWebhookFor(repo.owner.login, repo.name, evts, user.accessToken)
    await checkHandler.onDeleteCheck(repo.id, type)
    info(`${repo.full_name}: disabled check ${type}`)
  }

  /**
   * Executes hook triggered by github.
   *
   * @param  {object} payload
   * @return {json}
   */
  async onHandleHook(payload) {
    const {name, id, owner, full_name} = payload.repository
    const repo = await repositoryHandler.onGetOne(id, null, true)
    if (repo.checks.length) {
      const checks = repo.checks.reduce((m, c) => {m[c.type] = c; return m;}, {})
      // read config
      const zapprFileContent = await this.github.readZapprFile(owner.login, name, repo.checks[0].token)
      const config = Object.assign({}, DEFAULT_CONFIG, zapprFileContent)
      if (checks[Approval.type] && checks[Approval.type].token) {
        Approval.execute(this.github, config, payload, checks[Approval.type].token, repo.id, pullRequestHandler)
        info(`Executed approval hook for ${full_name}`)
      }
      if (checks[Autobranch.type] && checks[Autobranch.type].token) {
        Autobranch.execute(this.github, config, payload, checks[Autobranch.type].token)
        info(`Executed autobranch hook for ${full_name}`)
      }
    }
    return '"THANKS"'
  }
}

export const hookHandler = new HookHandler()
