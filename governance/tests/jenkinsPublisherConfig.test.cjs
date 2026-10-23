const { test } = require('node:test');
const assert = require('node:assert/strict');
const { publisherEnvironment } = require('../../utils/jenkinsPublisherConfig.cjs');

test('regional publisher loads ignored configuration only when shell configuration is absent', () => {
 const env=publisherEnvironment({KEEP:'yes'},{readFile(file){assert.match(file,/jenkins-publisher\.local\.json$/);return JSON.stringify({url:'http://localhost:8080/',user:'fixture',apiToken:'fixture-token'});}});
 assert.equal(env.JENKINS_URL,'http://localhost:8080'); assert.equal(env.KEEP,'yes'); assert.equal(env.JENKINS_USER,'fixture');
});
test('explicit publisher configuration never reads or mixes saved credentials', () => {
 const env={JENKINS_URL:'https://jenkins.example',JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'};
 assert.equal(publisherEnvironment(env,{readFile(){throw new Error('must not read');}}).JENKINS_USER,'fixture');
 assert.throws(()=>publisherEnvironment({JENKINS_URL:'https://different.example'},{readFile(){throw new Error('must not mix');}}),/Incomplete/);
});
test('unsafe URL and missing configuration fail before auth windows open without exposing secrets', () => {
 for(const url of ['http://remote.example','https://fixture:fixture-token@remote.example','https://remote.example/?token=fixture-token','file:///fixture']){
  assert.throws(()=>publisherEnvironment({JENKINS_URL:url,JENKINS_USER:'fixture',JENKINS_API_TOKEN:'fixture-token'}),error=>!error.message.includes('fixture-token'));
 }
 assert.throws(()=>publisherEnvironment({},{readFile(){throw new Error('fixture-token');}}),error=>!error.message.includes('fixture-token'));
});
