/**
 * @prettier
 */
const debounce = require('lodash/debounce')

const ErrorCode = require('../errorCode')
const Key = require('../key')
const Schema = require('../schema')
const Streams = require('../streams')
const Utils = require('../utils')
/**
 * @typedef {import('../SimpleGUN').UserGUNNode} UserGUNNode
 * @typedef {import('../SimpleGUN').GUNNode} GUNNode
 * @typedef {import('../SimpleGUN').ISEA} ISEA
 * @typedef {import('../SimpleGUN').ListenerData} ListenerData
 * @typedef {import('../schema').HandshakeRequest} HandshakeRequest
 * @typedef {import('../schema').Message} Message
 * @typedef {import('../schema').Outgoing} Outgoing
 * @typedef {import('../schema').PartialOutgoing} PartialOutgoing
 * @typedef {import('../schema').Chat} Chat
 * @typedef {import('../schema').ChatMessage} ChatMessage
 * @typedef {import('../schema').SimpleSentRequest} SimpleSentRequest
 * @typedef {import('../schema').SimpleReceivedRequest} SimpleReceivedRequest
 */

const DEBOUNCE_WAIT_TIME = 500

/**
 * @param {(userToIncoming: Record<string, string>) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @param {ISEA} SEA
 * @returns {void}
 */
const __onUserToIncoming = (cb, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)

  /** @type {Record<string, string>} */
  const userToIncoming = {}

  const mySecret = require('../../Mediator').getMySecret()

  user
    .get(Key.USER_TO_INCOMING)
    .map()
    .on(async (encryptedIncomingID, userPub) => {
      if (typeof encryptedIncomingID !== 'string') {
        if (encryptedIncomingID === null) {
          // on disconnect
          delete userToIncoming[userPub]
        } else {
          console.error(
            'got a non string non null value inside user to incoming'
          )
        }
        return
      }

      if (encryptedIncomingID.length === 0) {
        console.error('got an empty string value')
        return
      }

      const incomingID = await SEA.decrypt(encryptedIncomingID, mySecret)

      if (typeof incomingID === 'undefined') {
        console.warn('could not decrypt incomingID inside __onUserToIncoming')
        return
      }

      userToIncoming[userPub] = incomingID

      callb(userToIncoming)
    })
}

/**
 * @param {(avatar: string|null) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @throws {Error} If user hasn't been auth.
 * @returns {void}
 */
const onAvatar = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)
  // Initial value if avvatar is undefined in gun
  callb(null)

  user
    .get(Key.PROFILE)
    .get(Key.AVATAR)
    .on(avatar => {
      if (typeof avatar === 'string' || avatar === null) {
        callb(avatar)
      }
    })
}

/**
 * @param {(blacklist: string[]) => void} cb
 * @param {UserGUNNode} user
 * @returns {void}
 */
const onBlacklist = (cb, user) => {
  /** @type {string[]} */
  const blacklist = []

  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)

  // Initial value if no items are in blacklist in gun
  callb(blacklist)

  user
    .get(Key.BLACKLIST)
    .map()
    .on(publicKey => {
      if (typeof publicKey === 'string' && publicKey.length > 0) {
        blacklist.push(publicKey)
        callb(blacklist)
      } else {
        console.warn('Invalid public key received for blacklist')
      }
    })
}

/**
 * @param {(currentHandshakeAddress: string|null) => void} cb
 * @param {UserGUNNode} user
 * @returns {void}
 */
const onCurrentHandshakeAddress = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)

  // If undefined, callback below wont be called. Let's supply null as the
  // initial value.
  callb(null)

  user.get(Key.CURRENT_HANDSHAKE_ADDRESS).on(addr => {
    if (typeof addr !== 'string') {
      console.error('expected handshake address to be an string')

      callb(null)

      return
    }

    callb(addr)
  })
}

/**
 * @param {(displayName: string|null) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @throws {Error} If user hasn't been auth.
 * @returns {void}
 */
const onDisplayName = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)

  // Initial value if display name is undefined in gun
  callb(null)

  user
    .get(Key.PROFILE)
    .get(Key.DISPLAY_NAME)
    .on(displayName => {
      if (typeof displayName === 'string' || displayName === null) {
        callb(displayName)
      }
    })
}

/**
 * @param {(messages: Record<string, Message>) => void} cb
 * @param {string} userPK Public key of the user from whom the incoming
 * messages will be obtained.
 * @param {string} incomingFeedID ID of the outgoing feed from which the
 * incoming messages will be obtained.
 * @param {GUNNode} gun (Pass only for testing purposes)
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @returns {void}
 */
const onIncomingMessages = (cb, userPK, incomingFeedID, gun, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)

  const otherUser = gun.user(userPK)

  /**
   * @type {Record<string, Message>}
   */
  const messages = {}

  callb(messages)

  otherUser
    .get(Key.OUTGOINGS)
    .get(incomingFeedID)
    .get(Key.MESSAGES)
    .map()
    .on(async (data, key) => {
      if (!Schema.isMessage(data)) {
        console.warn('non-message received')
        return
      }

      /** @type {string} */
      const recipientEpub = await Utils.pubToEpub(userPK)

      const secret = await SEA.secret(recipientEpub, user._.sea)

      let { body } = data
      body = await SEA.decrypt(body, secret)

      messages[key] = {
        body,
        timestamp: data.timestamp
      }

      callb(messages)
    })
}

/**
 * @typedef {Record<string, Outgoing|null>} Outgoings
 * @typedef {(outgoings: Outgoings) => void} OutgoingsListener
 */

/**
 * @type {Outgoings}
 */
let currentOutgoings = {}

const getCurrentOutgoings = () => currentOutgoings

/** @type {Set<OutgoingsListener>} */
const outgoingsListeners = new Set()

const notifyOutgoingsListeners = () => {
  outgoingsListeners.forEach(l => l(currentOutgoings))
}

let outSubbed = false

/**
 * @param {OutgoingsListener} cb
 * @returns {() => void}
 */
const onOutgoing = cb => {
  outgoingsListeners.add(cb)
  cb(currentOutgoings)

  if (!outSubbed) {
    const user = require('../../Mediator').getUser()
    user.get(Key.OUTGOINGS).open(
      debounce(async data => {
        try {
          if (typeof data !== 'object' || data === null) {
            currentOutgoings = {}
            notifyOutgoingsListeners()
            return
          }

          /** @type {Record<string, Outgoing|null>} */
          const newOuts = {}

          const SEA = require('../../Mediator').mySEA
          const mySecret = await Utils.mySecret()

          await Utils.asyncForEach(Object.entries(data), async ([id, out]) => {
            if (typeof out !== 'object') {
              return
            }

            if (out === null) {
              newOuts[id] = null
              return
            }

            const { with: encPub, messages } = out

            if (typeof encPub !== 'string') {
              return
            }

            const pub = await SEA.decrypt(encPub, mySecret)

            if (!newOuts[id]) {
              newOuts[id] = {
                with: pub,
                messages: {}
              }
            }

            const ourSec = await SEA.secret(
              await Utils.pubToEpub(pub),
              user._.sea
            )

            if (typeof messages === 'object' && messages !== null) {
              await Utils.asyncForEach(
                Object.entries(messages),
                async ([mid, msg]) => {
                  if (typeof msg === 'object' && msg !== null) {
                    if (
                      typeof msg.body === 'string' &&
                      typeof msg.timestamp === 'number'
                    ) {
                      const newOut = newOuts[id]
                      if (!newOut) {
                        return
                      }
                      newOut.messages[mid] = {
                        body: await SEA.decrypt(msg.body, ourSec),
                        timestamp: msg.timestamp
                      }
                    }
                  }
                }
              )
            }
          })

          currentOutgoings = newOuts
          notifyOutgoingsListeners()
        } catch (e) {
          console.log('--------------------------')
          console.log('Events -> onOutgoing')
          console.log(e)
          console.log('--------------------------')
        }
      }, 400)
    )

    outSubbed = true
  }

  return () => {
    outgoingsListeners.delete(cb)
  }
}
////////////////////////////////////////////////////////////////////////////////
/**
 * @typedef {(chats: Chat[]) => void} ChatsListener
 */

/** @type {Chat[]} */
let currentChats = []

/** @type {Set<ChatsListener>} */
const chatsListeners = new Set()

const notifyChatsListeners = () => {
  chatsListeners.forEach(l => l(currentChats))
}

const processChats = debounce(() => {
  const pubToAvatar = Streams.getPubToAvatar()
  const pubToDn = Streams.getPubToDn()
  const existingOutgoings = /** @type {[string, Outgoing][]} */ (Object.entries(
    getCurrentOutgoings()
  ).filter(([_, o]) => o !== null))
  const pubToFeed = Streams.getPubToFeed()

  /** @type {Chat[]} */
  const newChats = []

  for (const [outID, out] of existingOutgoings) {
    if (typeof pubToAvatar[out.with] === 'undefined') {
      // eslint-disable-next-line no-empty-function
      Streams.onAvatar(() => {}, out.with)
    }
    if (typeof pubToDn[out.with] === 'undefined') {
      // eslint-disable-next-line no-empty-function
      Streams.onDisplayName(() => {}, out.with)
    }

    /** @type {ChatMessage[]} */
    let msgs = Object.entries(out.messages).map(([mid, m]) => ({
      id: mid,
      outgoing: true,
      body: m.body,
      timestamp: m.timestamp
    }))

    const incoming = pubToFeed[out.with]

    if (Array.isArray(incoming)) {
      msgs = [...msgs, ...incoming]
    }

    /** @type {Chat} */
    const chat = {
      recipientPublicKey: out.with,
      didDisconnect: pubToFeed[out.with] === 'disconnected',
      id: out.with + outID,
      messages: msgs,
      recipientAvatar: pubToAvatar[out.with] || null,
      recipientDisplayName: pubToDn[out.with] || null
    }

    newChats.push(chat)
  }

  currentChats = newChats.filter(
    c =>
      Array.isArray(pubToFeed[c.recipientPublicKey]) ||
      pubToFeed[c.recipientPublicKey] === 'disconnected'
  )

  notifyChatsListeners()
}, 750)

let onChatsSubbed = false

/**
 * Massages all of the more primitive data structures into a more manageable
 * 'Chat' paradigm.
 * @param {ChatsListener} cb
 * @returns {() => void}
 */
const onChats = cb => {
  if (!chatsListeners.add(cb)) {
    throw new Error('Tried to subscribe twice')
  }
  cb(currentChats)

  if (!onChatsSubbed) {
    onOutgoing(processChats)
    Streams.onAvatar(processChats)
    Streams.onDisplayName(processChats)
    Streams.onPubToFeed(processChats)

    onChatsSubbed = true
  }

  return () => {
    if (!chatsListeners.delete(cb)) {
      throw new Error('Tried to unsubscribe twice')
    }
  }
}

/** @type {string|null} */
let currentBio = null

/**
 * @param {(bio: string|null) => void} cb
 * @param {UserGUNNode} user Pass only for testing purposes.
 * @throws {Error} If user hasn't been auth.
 * @returns {void}
 */
const onBio = (cb, user) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)
  // Initial value if avvatar is undefined in gun
  callb(currentBio)

  user.get(Key.BIO).on(bio => {
    if (typeof bio === 'string' || bio === null) {
      currentBio = bio
      callb(bio)
    }
  })
}

/** @type {string|null} */
let currentSeedBackup = null

/**
 * @param {(seedBackup: string|null) => void} cb
 * @param {UserGUNNode} user
 * @param {ISEA} SEA
 * @throws {Error} If user hasn't been auth.
 * @returns {void}
 */
const onSeedBackup = (cb, user, SEA) => {
  if (!user.is) {
    throw new Error(ErrorCode.NOT_AUTH)
  }

  const mySecret = require('../../Mediator').getMySecret()

  const callb = debounce(cb, DEBOUNCE_WAIT_TIME)
  callb(currentSeedBackup)

  user.get(Key.SEED_BACKUP).on(async seedBackup => {
    if (typeof seedBackup === 'string') {
      currentSeedBackup = await SEA.decrypt(seedBackup, mySecret)
      callb(currentSeedBackup)
    }
  })
}

module.exports = {
  __onUserToIncoming,
  onAvatar,
  onBlacklist,
  onCurrentHandshakeAddress,
  onDisplayName,
  onIncomingMessages,
  onOutgoing,
  getCurrentOutgoings,
  onSimplerReceivedRequests: require('./onReceivedReqs').onReceivedReqs,
  onSimplerSentRequests: require('./onSentReqs').onSentReqs,
  getCurrentSentReqs: require('./onSentReqs').getCurrentSentReqs,
  onBio,
  onSeedBackup,
  onChats
}
