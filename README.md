# OPCUA sample server
This project implements an OPCUA server using the node-OPCUA open source standard library. Use this module to quickly stand up a OPCUA server on your network for testing. It uses simple configuration files that you define to provide your asset groups and associated variables.

This module will demonstrate:
* how to configure and start a OPCUA server and client
* how to create variables inside the OPCUA server
* how to read the variables and update the values

## Dependencies
* [Docker](https://www.docker.com/products/docker-desktop) engine
* [Visual Studio Code](https://code.visualstudio.com/Download) with [TSLint](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-tslint-plugin) extension installed
* [Node.js](https://nodejs.org/en/download/) v14
* [TypeScript](https://www.npmjs.com/package/typescript)
* [node-OPCUA](http://node-opcua.github.io/)
* An [Azure Container Registry](https://docs.microsoft.com/azure/container-registry/) to host your versions of the modules

## Design
This project is written in NodeJS and TypeScript implements a OPCUA server using the open source node-OPCUA library. It implements both the server and client interfaces. The server interface is used to configure the server and start the OPCUA endpoint. The client interface is used to start a test interface that can update the variables on a period basis to mimic telemetry from PLCs or other sources.
* The server is configured by providing a configuration file. This file defines the server configuration and the list of "device" files. The "device" files represent OPCUA assets and their associated variables.

## Setup the dev environment
* Clone the repository from [here](https://github.com/sseiber/opcua-server-sample)
* Run the install commmand (requires NodeJS/NPM)
  ```
  npm i
  ```
* After installation you should see the following files in your project
  ```
  ./configs/imageConfig.json
  ./configs/local.json
  ```
  Edit the `./configs/imageConfig.json` file with your specific image name including the container registry. e.g.:
  ```
  {
    "arch": "amd64",
    "imageName": "mycontainerregistry.azurecr.io/iiot-gateway",
    "versionTag": "latest"
  }
  ```
  Note: The `./config/` files are ignored from source control. You can specify your image name that will be used when building the docker image as well as the version tag to use.

* Create a `./storage` directory in your cloned project
    * Note: this directory will be ignored from source control so you can use it to store your own copies of config files, or files with secrets like certificates, etc.
* Now you are ready to build the code. To build the code run the package.json script:
  ```
  npm run dockerbuild
  ```
* After successfully building the docker image you can push the docker image to your container registry (the same container registry you specified in the `./storage/deployment.amd64.json` file):
  ```
  npm run dockerpush
  ```
  Note: if your `./configs/imageConfig.json` file specifies the `versionTag` field, this field will be used as the docker image tag. If you remove the `versionTag` field from this file it will use `latest` as the version tag. However, if you use the `npm version` command it will build and push the docker image using the `package.json` version field and also auto-increment the package.json version field. Example:
  ```
  npm version patch
  ```
