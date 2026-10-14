import { configuration, deployment, digest } from '../contracts.mjs';
import { J } from '../serialization.mjs';
import { reject } from '../errors.mjs';

/** Closed, pure renderer: validated data slots cannot add syntax or select code. */
export function render(template, provider, config, deploy) {
  const normalized=configuration(Buffer.from(J(config)));
  const selected=deployment(Buffer.from(J(deploy)));
  if(selected.provider!==provider)reject('GENERATION_INVALID');
  const slots={
    LABEL:provider==='gitlab'?selected.options.runnerTag:selected.options.agentLabel,
    CONFIGURATION_DIGEST:digest(J(normalized)),
    DISTRIBUTION_DIGEST:selected.distributionDigest
  };
  const seen=new Set();
  const text=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{
    if(!Object.hasOwn(slots,key)||seen.has(key))reject('GENERATION_INVALID');
    seen.add(key);return slots[key];
  });
  if(seen.size!==3||text.includes('{{')||!text.endsWith('\n')||text.endsWith('\n\n')||/[\r\x00-\x09\x0b-\x1f\x7f]/.test(text))reject('GENERATION_INVALID');
  const bytes=Buffer.from(text,'utf8');
  if(bytes.length>32768)reject('OUTPUT_LIMIT');
  return bytes;
}
