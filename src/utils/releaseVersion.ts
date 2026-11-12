// Public stable releases and private part betas have distinct provenance.
export function parseReleaseVersion(value:string) {
 const m=value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(?:part(\d+)-)?(alpha|beta|rc)[.-]?(\d+))?(?:\+([\w.-]+))?$/i);
 if(!m)return;
 return {core:m.slice(1,4).map(Number),part:Number(m[4]||0),stage:m[5]?.toLowerCase(),iteration:Number(m[6]||0),build:m[7]};
}
export function compareReleaseVersions(a:string,b:string):number|undefined {
 const x=parseReleaseVersion(a),y=parseReleaseVersion(b);if(!x||!y)return;
 for(let i=0;i<3;i++)if(x.core[i]!==y.core[i])return Math.sign(x.core[i]-y.core[i]);
 if(!x.stage||!y.stage)return x.stage?-1:y.stage?1:0;
 if(x.part!==y.part)return Math.sign(x.part-y.part);
 const rank={alpha:0,beta:1,rc:2};
 const order=rank[x.stage as keyof typeof rank]-rank[y.stage as keyof typeof rank];
 // SemVer build metadata is identity, not a trustworthy update ordering.
 return Math.sign(order||x.iteration-y.iteration);
}
export function publicRelease(value:unknown,current:string) {
 const r=value as Record<string,unknown>;
 if(!r||r.draft!==false||r.prerelease!==false||typeof r.tag_name!=='string'||typeof r.html_url!=='string'||!/^https:\/\/github\.com\/vex2137\/Kalendarz\/releases\/tag\/[^\s]+$/.test(r.html_url)||parseReleaseVersion(r.tag_name)?.stage)throw Error('Invalid stable release metadata');
 const comparison=compareReleaseVersions(r.tag_name,current);if(comparison===undefined)throw Error('Unrecognized release version');
 return {available:comparison>0,version:r.tag_name,url:r.html_url,notes:typeof r.body==='string'?r.body.slice(0,3000):''};
}
