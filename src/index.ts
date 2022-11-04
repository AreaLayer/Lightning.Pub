import 'dotenv/config'
import NewServer from '../proto/autogenerated/ts/express_server'
import GetServerMethods from './services/serverMethods'
import serverOptions from './auth';
import Storage from './services/storage'
import LND from './services/lnd'
import Main from './services/main'
(async () => {
    const storageHandler = new Storage()
    const lndHandler = new LND()
    const mainHandler = new Main(storageHandler, lndHandler)
    await storageHandler.Connect()
    const Server = NewServer(GetServerMethods(mainHandler), serverOptions)
    Server.Listen(3000)
})()
