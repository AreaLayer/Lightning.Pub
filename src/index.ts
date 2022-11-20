import 'dotenv/config'
import NewServer from '../proto/autogenerated/ts/express_server'
import GetServerMethods from './services/serverMethods'
import serverOptions from './auth';
import Main, { LoadMainSettingsFromEnv } from './services/main'
import { LoadNosrtSettingsFromEnv } from './services/nostr'
import nostrMiddleware from './nostrMiddleware.js'

const start = async () => {
    const mainHandler = new Main(LoadMainSettingsFromEnv())
    await mainHandler.storage.Connect()

    const serverMethods = GetServerMethods(mainHandler)
    const nostrSettings = LoadNosrtSettingsFromEnv()
    nostrMiddleware(serverMethods, mainHandler, nostrSettings)
    const Server = NewServer(serverMethods, serverOptions(mainHandler))
    Server.Listen(3000)
}
start()