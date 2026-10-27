"""Provision D1 and deploy. API token is read without echo and never persisted."""
import getpass,json,os,subprocess,urllib.request,urllib.error,re,sys
TOKEN=getpass.getpass('Cloudflare token (hidden): ')
ACCOUNT='6449b624baf0e2515234eb08ace8dbda'
def api(path,method='GET',payload=None):
 req=urllib.request.Request('https://api.cloudflare.com/client/v4'+path,data=json.dumps(payload).encode() if payload is not None else None,headers={'Authorization':'Bearer '+TOKEN,'Content-Type':'application/json'},method=method)
 try:
  with urllib.request.urlopen(req,timeout=40) as r: result=json.load(r)
 except urllib.error.HTTPError as e:
  try: details=json.load(e)
  except Exception: details={}
  print('Cloudflare request failed:',e.code,[(x.get('code'),x.get('message')) for x in details.get('errors',[])])
  sys.exit(1)
 if not result.get('success'):print('Cloudflare operation failed.');sys.exit(1)
 return result['result']
api('/accounts/'+ACCOUNT+'/tokens/verify');print('Token verified.',flush=True)
databases=api('/accounts/'+ACCOUNT+'/d1/database');database=next((d for d in databases if d['name']=='ltmclass'),None)
if not database: database=api('/accounts/'+ACCOUNT+'/d1/database','POST',{'name':'ltmclass'})
id=database['uuid'];print('D1 ready:',id,flush=True)
config=open('wrangler.jsonc').read();config=re.sub(r'"database_id": "[^"]+"','"database_id": "'+id+'"',config);open('wrangler.jsonc','w').write(config)
env={**os.environ,'CLOUDFLARE_API_TOKEN':TOKEN,'CLOUDFLARE_ACCOUNT_ID':ACCOUNT,'CI':'true','WRANGLER_SEND_METRICS':'false'}
for args in [['node_modules/.bin/wrangler','d1','migrations','apply','ltmclass','--remote'],['node_modules/.bin/wrangler','deploy']]:
 result=subprocess.run(args,env=env)
 if result.returncode:sys.exit(result.returncode)
