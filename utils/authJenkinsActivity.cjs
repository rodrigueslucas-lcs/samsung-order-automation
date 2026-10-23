const { publisherEnvironment } = require('./jenkinsPublisherConfig.cjs');
const JOBS = /^(?:Samsung-SMB-(?:MX|PE|CO|CL)|SAMSUNG-SMB-AUTOMATION)$/i;
async function jenkinsBuildsIdle(env, { request = fetch, markets = ['mx','pe','co','cl'] } = {}) {
  const config = publisherEnvironment(env);
  const headers = { Authorization: `Basic ${Buffer.from(`${config.JENKINS_USER}:${config.JENKINS_API_TOKEN}`).toString('base64')}` };
  const read = async endpoint => {
    const response = await request(config.JENKINS_URL + endpoint, { headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Jenkins activity cannot be confirmed; auth maintenance was not started.');
    return response.json();
  };
  const [jobs, queue] = await Promise.all([read('/api/json?tree=jobs[name,builds[number,building]]'), read('/queue/api/json?tree=items[task[name]]')]);
  if (!Array.isArray(jobs.jobs) || !Array.isArray(queue.items)) throw new Error('Jenkins activity response is invalid; auth maintenance was not started.');
  const relevant = name => JOBS.test(name) && (name.toUpperCase() === 'SAMSUNG-SMB-AUTOMATION' || markets.includes(name.split('-').at(-1).toLowerCase()));
  if (jobs.jobs.some(job => relevant(job.name) && !Array.isArray(job.builds))) throw new Error('Jenkins build activity is incomplete; maintenance was not started.');
  const active = jobs.jobs.filter(job => relevant(job.name) && job.builds?.some(build => build.building)).map(job => job.name);
  const queued = queue.items.filter(item => relevant(item.task?.name || '')).map(item => item.task.name);
  return { idle: active.length === 0 && queued.length === 0, active, queued };
}
module.exports = { jenkinsBuildsIdle };
