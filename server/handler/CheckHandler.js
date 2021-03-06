import Approval from '../checks/Approval'
import { Check } from '../model'

import { logger } from '../../common/debug'
const debug = logger('check-handler')

class CheckHandler {
  onCreateCheck(repoId, type, token) {
    debug(`create check ${type} for repo ${repoId} w/ token ${token ? token.substr(0, 4) : 'NONE'}`)
    return Check.create({
      repositoryId: repoId,
      type,
      token,
      arguments: {}
    })
  }

  onRefreshTokens(repoIds, token) {
    // noop for now
    // implement this when we fucked up
    return Promise.resolve()
  }

  onDeleteCheck(repoId, type) {
    debug(`delete check ${type} for repo ${repoId}`)
    return Check.destroy({
      where: {
        repositoryId: repoId,
        type
      }
    })
  }
}

export const checkHandler = new CheckHandler()
