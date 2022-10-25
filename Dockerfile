FROM node:16

RUN apt-get update && apt-get install -y && apt-get install -y argon2

RUN mkdir /code

COPY /node-server /code/node-server
ADD tsconfig.json package.json /code/

WORKDIR /code
RUN yarn install

WORKDIR /code/node-server
RUN yarn install

EXPOSE 4000