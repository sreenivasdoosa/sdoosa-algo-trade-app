## Installation & Deployment Instructions

-- **Prerequisites**
 - Node JS >= 6.0 should be installed on your machine
 - Note: Due to some library dependecies the Node JS >= 11 version does not work with this app.
   Hence please install Node JS < 11 version and >= 6 version.
 
-- **Installation**
1. Open command prompt and run the following command to install gulp globally
    `npm install -g gulp`
2. Go to project root directory (Ex: D:\sdoosa-algo-trade-app\).
3. Run the command `npm install` to install all dependent npm libraries.
4. Run the command `gulp deploy` to compile the source code. 
   This will compile the code to `dist` folder in your project root directory.
5. If you change only client source code then you can run `gulp deploy-client`.
   Similarly if you change only server code you can run `gulp deploy-server` commands. 
   The command `gulp deploy` compiles both server and client code.
 
-- **Deployment and Configuration**
1. Create a new directory with the path `C:\algo-trade\`
2. Copy the `config` folder from the project path (Ex: `D:\sdoosa-algo-trade-app\src\config`) to `C:\algo-trade\` folder.
3. After copying the config path would be `C:\algo-trade\config\`. 
4. There are 4 json files in the config path `C:\algo-trade\config\` which are used by the algo app. 
   They are `users.json`, `config.json`, `strategies.json` and `holidays.json`
5. Edit `users.json` file to configure your username and password to login to the app. 
   Note: These are just for app login not broker login credentials.
6. Edit `config.json` and configure the port number on which you would like to run the algo trade app. 
   Default port used is `8080`. You need to set `enableSSL` to `true` when you deploy the app on public domain. Because brokers
   do not accept your public domain with just `http`. They expect your server to support `https`. So when you deploy on cloud
   the redirect URL you configure starts with `https` instead of `http`. Brokers support `http` only with `localhost` if you are
   running the app on your local machine instead of cloud.
7. When you set `enableSSL` to `true` the app expects the `server.key` and `server.cert` files to be present in the folder `C:\algo-trade\ssl-cert\`.
   Please do search on google how to generate self certified SSL certificate and key and then create the above files 
   `server.cert` and `server.key` and put the in the mentioned folder. 
   You can skip this step if you are running the app on your machine locally. This is needed only when you deploy the app on cloud.
8. Configure your brokers API key and secret key under each broker section. 
   If you have not subscribed to any broker, then please put some dummy values in api key and secret key fields. 
   Copy the redirect URL from the respective broker section and go to your broker developer account and 
   configure the the same in the app of your developer account where you have subscribed to APIs.
9. Edit `strategies.json` file and configure the parameters for execution of strategy as per the provided details in this file. 
   Each strategy that you are going to develop should have an entry in this file. 
10. Edit `holidays.json` if necessary. 
   Ideally this should be updated once in a year by getting all trading holidays list from your broker.

-- **Starting Server**
1. Open command prompt and go to project root directory. (Ex: `D:\sdoosa-algo-trade-app\`)
2. Run the command `gulp server` to start the app
3. You should see the logs as `app started and listening on port 8080/8443` without any errors.
4. Next open your browser and enter `http://localhost:8080` in new tab/window.
5. Login to the app (with any of the user credentials that you have configured in `users.json` in above section)
6. Go to to the respective broker tab and click on `Login to {broker name}`to sign in to your broker.
   This will redirect you to broker authentication page. Login with with your client credentials of the corresponding broker 
   and accept T&C if any then you will be redirected to algo trade app page.
7. Click on `Start Algo..` button to start the algo on your app.
8. Start observing the logs on command prompt and on your broker terminal if all things are working as expected or not.
9. Have a good day :)
