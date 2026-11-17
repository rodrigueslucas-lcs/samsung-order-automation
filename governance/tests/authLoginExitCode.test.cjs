const {test}=require('node:test');
const assert=require('node:assert/strict');
const {authLoginExitCode}=require('../../utils/authLoginExitCode.cjs');
for(const message of ['page.goto: Target page, context or browser has been closed','browser has been closed','Target closed','frame was detached'])test(`lost local target classified for one reconnect: ${message}`,()=>assert.equal(authLoginExitCode(Error(message)),75));
for(const message of ['net::ERR_NAME_NOT_RESOLVED','SAMSUNG_ACCOUNT_SECURITY_BLOCKED','Captcha verification failed','Email control not rendered','Timeout 30000ms exceeded'])test(`unproven/provider errors cannot restart login: ${message}`,()=>assert.equal(authLoginExitCode(Error(message)),1));
for(const exitCode of [73,78,79])test(`explicit provider/human code ${exitCode} wins over incidental target loss`,()=>assert.equal(authLoginExitCode(Object.assign(Error('Target closed'),{exitCode})),exitCode));
