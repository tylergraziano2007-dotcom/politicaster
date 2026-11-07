/* Politicaster game module (single-player engine + UI).
 * Ported from the single-file prototype. Rendering is string-based and mounts into a
 * container element; see src/components/LegacyGame.jsx. The engine can also run headless.
 */

/* ================= Utilities ================= */
// Seeded RNG: when a game is running, randomness comes from G.rng (saved with the game),
// so the same state + the same inputs always resolve the same way. Before a game exists
// (setup screens), it falls back to Math.random.
function rnd(){if(G&&typeof G.rng==='number'){let t=(G.rng=(G.rng+0x6D2B79F5)|0);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}return Math.random();}
function newSeed(){return (Math.random()*4294967296)>>>0;}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pick=a=>a[Math.floor(rnd()*a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function gauss(){let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pct=(x,d=1)=>(x*100).toFixed(d);
const money=x=>'$'+(Math.round(x*10)/10).toFixed(1)+'M';
const sgn=(x,d=1)=>(x>=0?'+':'−')+Math.abs(x).toFixed(d);
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return Math.abs(h);}
const seeded=(arr,key)=>arr[hash(key)%arr.length];
const store={
  get(k){try{const v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(e){return null;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}},
  del(k){try{localStorage.removeItem(k);}catch(e){}}
};

/* ================= Data ================= */
const ISSUES=[
 {n:'Taxes & spending',L:'Tax the wealthy, fund programs',R:'Cut taxes, cut spending'},
 {n:'Healthcare',L:'Government-run healthcare',R:'Private, market-based care'},
 {n:'Immigration',L:'Expand legal pathways',R:'Strict border enforcement'},
 {n:'Guns',L:'Stricter gun laws',R:'Protect gun rights'},
 {n:'Climate & energy',L:'Rapid green transition',R:'All-in on oil and gas'},
 {n:'Crime & policing',L:'Reform policing',R:'Tough on crime'},
 {n:'Abortion',L:'Protect access',R:'Restrict access'},
 {n:'Education',L:'Fund public schools, cancel student debt',R:'School choice, no debt bailouts'},
 {n:'Foreign policy',L:'Diplomacy first',R:'Peace through strength'}
];
function posText(i,v){const s=ISSUES[i];const p=Math.round(Math.abs(v)/2*100);if(p<10)return 'Middle ground';return p+'% '+(v<0?'left: '+s.L:'right: '+s.R);}
const BLOCS=[
 {k:'prog',n:'Urban progressives'},{k:'young',n:'Young voters'},{k:'union',n:'Union workers'},{k:'suburb',n:'Suburban moderates'},
 {k:'senior',n:'Seniors'},{k:'biz',n:'Small business owners'},{k:'rural',n:'Rural conservatives'},{k:'faith',n:'Faith & family voters'}
];
const BK=BLOCS.map(b=>b.k);
const BNAME=Object.fromEntries(BLOCS.map(b=>[b.k,b.n]));
const IDEAL={prog:[-2,-2,-2,-2,-2,-2,-2,-2,-1],young:[-1,-1,-1,-1,-2,-1,-1,-2,-1],union:[-1,-1,1,1,1,0,0,-1,0],suburb:[0,0,0,-1,-1,1,-1,0,0],senior:[0,-1,1,1,0,1,1,1,1],biz:[2,1,0,1,1,1,0,1,0],rural:[1,1,2,2,2,2,1,1,1],faith:[1,1,1,1,1,1,2,2,1]};
const WEIGHT={prog:[2,3,2,2,3,2,3,1,1],young:[1,2,1,1,3,1,2,3,1],union:[3,2,2,1,2,1,1,1,1],suburb:[3,2,1,2,1,2,2,2,1],senior:[2,3,2,1,1,2,1,1,2],biz:[3,2,1,1,2,1,1,1,1],rural:[1,1,3,3,2,2,2,1,1],faith:[1,1,1,1,1,2,3,3,1]};
const PULL_D={prog:.9,young:.4,union:.2,suburb:0,senior:-.15,biz:-.3,rural:-.7,faith:-.6};
const PRIMW={D:{prog:2.5,young:1.8,union:1.2,suburb:.8,senior:.6,biz:.3,rural:.1,faith:.2},R:{prog:.1,young:.3,union:.6,suburb:.8,senior:1.2,biz:1.5,rural:2.5,faith:2.2}};
const MIX={U:[.22,.18,.10,.20,.12,.08,.04,.06],S:[.12,.13,.08,.27,.15,.12,.06,.07],M:[.08,.10,.20,.16,.16,.10,.10,.10],R:[.04,.08,.08,.10,.16,.14,.24,.16],B:[.10,.15,.07,.20,.15,.13,.08,.12]};
const DOM_BLOC={U:'prog',S:'suburb',M:'union',R:'rural',B:'suburb'};
const DEF={D:[-1,-1,-1,-1,-1,0,-2,-1,0],R:[1,1,2,1,1,1,1,1,1]};
const RAW=`AK,Alaska,3,-8,R,0,0
ME,Maine,4,2,M,0,11
WI,Wisconsin,10,0,M,1,6
VT,Vermont,3,16,U,1,10
NH,New Hampshire,4,1,S,1,11
WA,Washington,12,8,U,2,1
ID,Idaho,4,-18,R,2,2
MT,Montana,4,-11,R,2,3
ND,North Dakota,3,-20,R,2,4
MN,Minnesota,10,1,M,2,5
IL,Illinois,19,7,U,2,6
MI,Michigan,15,0,M,2,7
NY,New York,28,10,U,2,9
MA,Massachusetts,11,15,U,2,10
OR,Oregon,8,6,U,3,1
NV,Nevada,6,0,B,3,2
WY,Wyoming,3,-25,R,3,3
SD,South Dakota,3,-16,R,3,4
IA,Iowa,6,-6,M,3,5
IN,Indiana,11,-11,M,3,6
OH,Ohio,17,-6,M,3,7
PA,Pennsylvania,19,0,M,3,8
NJ,New Jersey,14,6,S,3,9
CT,Connecticut,7,7,S,3,10
RI,Rhode Island,4,8,U,3,11
CA,California,54,13,U,4,1
UT,Utah,6,-13,R,4,2
CO,Colorado,10,4,S,4,3
NE,Nebraska,5,-11,R,4,4
MO,Missouri,10,-10,M,4,5
KY,Kentucky,8,-16,R,4,6
WV,West Virginia,4,-22,R,4,7
VA,Virginia,13,3,S,4,8
MD,Maryland,10,14,S,4,9
DE,Delaware,3,7,S,4,10
AZ,Arizona,11,-2,B,5,2
NM,New Mexico,5,3,B,5,3
KS,Kansas,6,-10,R,5,4
AR,Arkansas,6,-16,R,5,5
TN,Tennessee,11,-14,R,5,6
NC,North Carolina,16,-2,B,5,7
SC,South Carolina,9,-8,B,5,8
DC,District of Columbia,3,40,U,5,9
OK,Oklahoma,7,-20,R,6,4
LA,Louisiana,8,-12,R,6,5
MS,Mississippi,6,-11,R,6,6
AL,Alabama,9,-15,R,6,7
GA,Georgia,16,-2,B,6,8
HI,Hawaii,4,15,U,7,0
TX,Texas,40,-5,B,7,4
FL,Florida,30,-5,B,7,9`;
const ST={};
const ST_LIST=RAW.split('\n').map(l=>{const [a,n,ev,lean,p,r,c]=l.split(',');const o={a,n,ev:+ev,lean:+lean,p,r:+r,c:+c};ST[a]=o;return o;});
const BATTLEGROUND=['PA','MI','WI','AZ','GA','NC','NV'];
const PRIMARY_ROUNDS=[{n:'Iowa & New Hampshire',st:['IA','NH']},{n:'Nevada & South Carolina',st:['NV','SC']},{n:'Super Tuesday',st:['TX','CA','NC','VA','MA','MN','CO','TN','AL','OK']}];

let ROSTER=[];
const BGS={
 governor:{n:'Governor',title:'Gov.',d:'Ran a state. Knows how to sign things.',stats:{cha:3,deb:3,fund:3,comp:4},cred:66},
 senator:{n:'Senator',title:'Sen.',d:'Two decades of committee hearings. Strong debater.',stats:{cha:3,deb:4,fund:3,comp:3},cred:60},
 mogul:{n:'Business mogul',title:'',d:'Deep pockets, shallow policy bench. Starts with extra cash.',stats:{cha:3,deb:2,fund:5,comp:3},cred:57,cash:8},
 general:{n:'Retired general',title:'Gen.',d:'Commanding presence. Has never told a joke on purpose.',stats:{cha:2,deb:3,fund:3,comp:5},cred:70},
 celebrity:{n:'Celebrity',title:'',d:'Already famous. Starts with momentum. Policy knowledge pending.',stats:{cha:5,deb:2,fund:4,comp:2},cred:52,mom:3},
 organizer:{n:'Grassroots organizer',title:'',d:'Knows every volunteer by name. Ground game is 50% stronger.',stats:{cha:4,deb:3,fund:2,comp:4},cred:63},
 mayor:{n:'Big-city mayor',title:'Mayor',d:'Knows potholes intimately. Urban voters like you.',stats:{cha:4,deb:3,fund:3,comp:3},cred:62,fx:{prog:2,young:1}},
 host:{n:'Talk show host',title:'',d:'Lives on camera. Interviews build 50% more momentum.',stats:{cha:5,deb:3,fund:3,comp:2},cred:55},
 activist:{n:'Activist',title:'',d:'Twenty years of protests. Young voters trust you.',stats:{cha:4,deb:4,fund:2,comp:3},cred:60,fx:{young:3}},
 smallbiz:{n:'Small business owner',title:'',d:'Has made payroll. Business owners notice.',stats:{cha:3,deb:3,fund:4,comp:3},cred:62,fx:{biz:3}},
 astronaut:{n:'Astronaut',title:'',d:'Literally went to space. Trusted, steady, slightly boring.',stats:{cha:3,deb:2,fund:3,comp:5},cred:70,fx:{young:1,senior:1}},
 cabinet:{n:'Former cabinet secretary',title:'Sec.',d:'Knows how Washington works. Starts with a debate prep session.',stats:{cha:2,deb:4,fund:4,comp:3},cred:64},
 sheriff:{n:'County sheriff',title:'Sheriff',d:'Tough, local, and folksy. Seniors and rural voters approve.',stats:{cha:3,deb:3,fund:3,comp:4},cred:63,fx:{senior:2,rural:2}}
};
const PERKS={silver:{n:'Silver tongue',d:'+1 debate skill.'},rolodex:{n:'Rolodex',d:'Fundraising brings in 40% more.'},stamina:{n:'Iron stamina',d:'An extra action every other week.'},local:{n:'Hometown hero',d:'A big boost in your home state.'},teflon:{n:'Teflon',d:'Scandals hit softer, and your secret surfaces slower.'},
 shark:{n:'Debate shark',d:'Better odds on every debate answer and rebuttal.'},guru:{n:'Ground game guru',d:'Ground game is 60% stronger.'},darling:{n:'Media darling',d:'Interviews build more momentum and gaffes are rarer.'},bipartisan:{n:'Bipartisan',d:'Suburban moderates and credibility both get a boost.'},comeback:{n:'Comeback kid',d:'When you trail nationally, you gain momentum each week.'}};
const FLAWS={gaffe:{n:'Gaffe machine',d:'Rallies and interviews can go sideways.'},fuse:{n:'Short fuse',d:'Attacks get under your skin in debates.'},thin:{n:'Thin skin',d:'Sometimes you lose an action fighting online.'},spender:{n:'Big spender',d:'Everything costs 25% more.'},wooden:{n:'Wooden',d:'Your rallies are 40% less effective.'},
 workaholic:{n:'Workaholic',d:'An extra action every week, but your secret surfaces much faster and you sometimes burn out.'},lightweight:{n:'Lightweight',d:'Worse odds on policy answers in debates.'},polarizing:{n:'Polarizing',d:'Your base loves you. Swing voters really don’t.'},cheapskate:{n:'Cheapskate',d:'Fundraisers bring in 25% less.'},overconfident:{n:'Overconfident',d:'Debate wins and losses both hit 50% harder.'}};
const STAT_TIPS={cha:'Charisma: makes rallies and interviews stronger and gives a small boost everywhere.',deb:'Debate: raises your odds on every debate answer.',fund:'Fundraising: sets how much each fundraiser brings in.',comp:'Composure: steadies you in debates and under pressure.'};
const SECRETS=['A restaurant chain you quietly ran into bankruptcy','Your bestselling memoir was entirely ghostwritten','You skipped jury duty four times and lied about it','A college a cappella album you hoped the world would never hear','A side business selling very questionable vitamin gummies'];
const ERAS=[{k:'1800',n:'Founding era',y:'1800'},{k:'1860',n:'Civil War era',y:'1860'},{k:'1932',n:'Great Depression',y:'1932'},{k:'1960',n:'TV era',y:'1960'},{k:'1980',n:'Reagan era',y:'1980'},{k:'present',n:'Present day',y:'2028'}];
const CP_COLORS=['#1E9E8A','#8E44AD','#E07B1A','#5A7D2B','#C2397A','#2E8FB8'];
const VP_NAMES=['Nora Castellanos','Jim Okonkwo','Beth Lindqvist','Marcus Delacroix','Priya Raman','Hank Sorensen','Tess Whitaker','Luis Montoya','Grace Abernathy','Dale Kowalski'];
const VP_TYPES=[
 {k:'swing',n:'Swing-state senator',d:'Safe, steady, and from a state you need. Boosts you in their home state.',fx:{blocs:{suburb:2}}},
 {k:'star',n:'Rising star',d:'Electric on TV. Big with young voters and adds momentum.',fx:{blocs:{young:4},mom:2}},
 {k:'general',n:'Retired general',d:'Gravitas and a very firm handshake. Seniors and credibility.',fx:{blocs:{senior:3},cred:5}},
 {k:'ceo',n:'Former CEO',d:'A donor network and a yacht nobody asked about. Cash, but unions grumble.',fx:{cash:10,blocs:{union:-3}}}
];
const NETS=['BSN','Liberty Eagle News','Progress 24','WNWS Local 7','The Wire Desk'];
const INTERN=['What if we bought a blimp? Just a blimp. With your face.','I made you a TikTok. Your handle is @maybe_potus. It has 3 followers, and one is my mom.','Hear me out: a rally on a cruise ship. International waters, no fire marshal.','We should trademark the word “freedom” before the other side does.','What if you challenged your opponent to a hot dog eating contest? For democracy.','I think we should rebrand you as “the cool uncle of politics.”','Could we get a celebrity endorsement? I know a guy who was on a dating show.','What if your campaign slogan was just a really long pause?'];
const GAFFES=['{name} calls {state} “a lovely little province.”','{name} mispronounces the name of the state they’re standing in.','{name} accidentally praises {opp} for 11 seconds before catching it.','{name} says “I love farmers, I could just eat them up.” Aides say context helps.','{name} confidently describes a sandwich as “a kind of soup.” The internet erupts.','{name} waves to a crowd that turns out to be a wall.'];
const VOICE_NAMES={prog:['Maya, 27, Philadelphia','Jordan, 31, Portland','Dev, 29, Chicago'],young:['Kayla, 20, Madison','Tyler, 22, Tempe','Ana, 19, Atlanta'],union:['Frank, 54, Toledo','Denise, 47, Flint','Ray, 58, Erie'],suburb:['Lauren, 41, Cobb County','Mike, 45, Bucks County','Priya, 38, Plano'],senior:['Dolores, 71, Tampa','Walt, 76, Scottsdale','June, 68, Dubuque'],biz:['Carlos, 49, owns a hardware store','Beth, 52, runs a bakery','Tom, 44, plumbing contractor'],rural:['Earl, 63, farmer','Wade, 39, rancher','Sue, 57, grain co-op'],faith:['Pastor Dan, 50','Rachel, 36, mother of four','Grace, 61, church choir']};
const FG={
 prog:{up:['Finally, someone not afraid of big ideas.','I’m warming up. Don’t make me regret it.'],down:['Feels like I’m being taken for granted.','Where did the fighter I liked go?'],flat:['Still waiting to hear something bold.']},
 young:{up:['Okay, this is actually kind of exciting?','My group chat is talking about you. In a good way.'],down:['You sound like my dad’s Facebook.','Why would I even bother voting?'],flat:['Talk to me about rent and student loans.']},
 union:{up:['You showed up. That counts for a lot around here.','Sounds like someone who’s worked a real shift.'],down:['Another suit who forgets us after November.','Where were you when the plant closed?'],flat:['Talk to me about jobs, not slogans.']},
 suburb:{up:['You seem reasonable. That’s rare these days.','I could see myself voting for you. Could.'],down:['Too extreme for me. I just want things calm.','I’m tired of the yelling.'],flat:['I’m still undecided. Show me you’re steady.']},
 senior:{up:['You remind me of when politicians had manners.','Just don’t touch my Medicare and we’re fine.'],down:['I don’t trust anyone who can’t sit still.','Too much flash, not enough substance.'],flat:['I want to know my Social Security is safe.']},
 biz:{up:['Finally, someone who understands payroll.','My margins thank you.'],down:['Every new rule is another form I have to fill out.','You don’t get how hard it is to stay open.'],flat:['Taxes and red tape. That’s my whole list.']},
 rural:{up:['Didn’t expect to like you. Here we are.','You talk like you’ve been on a farm.'],down:['You don’t know the first thing about out here.','City people deciding our lives again.'],flat:['Come out here and see it yourself.']},
 faith:{up:['I believe you’ll stand up for families.','You’re in my prayers, and maybe my vote.'],down:['I can’t support someone who disrespects our values.','You’ve lost a lot of folks at my church.'],flat:['I need to know where you stand on family.']}
};

const US_PATHS={"AL":"M648,492L648,492L648,492ZM642,384L689,380L702,427L710,440L706,450L709,457L708,465L711,469L661,474L666,486L664,490L656,488L653,482L652,490L646,489L642,455L644,386Z","AK":"M104,552L104,552L104,552ZM99,570L103,565L105,569ZM95,582L95,582L95,582ZM93,575L99,571L105,573L95,580ZM93,583L93,583L93,583ZM89,588L89,588L89,588ZM72,594L72,594L72,594ZM71,592L71,592L71,592ZM68,593L68,593L68,593ZM66,590L66,590L66,590ZM68,564L68,564L68,564ZM61,591L61,591L61,591ZM58,592L58,592L58,592ZM66,524L66,524L66,524ZM56,596L56,596L56,596ZM45,597L45,597L45,597ZM43,595L43,595L43,595ZM41,596L41,596L41,596ZM44,547L50,547L48,552ZM31,601L38,596L37,601ZM51,505L66,500L65,504L74,504L73,498L67,496L66,492L59,484L62,481L67,481L75,471L87,468L89,465L95,469L101,469L104,472L109,471L123,474L126,472L133,474L147,547L155,547L164,555L169,546L181,554L193,565L200,567L203,573L201,578L193,574L188,565L183,563L178,557L171,551L173,557L168,559L160,554L151,551L141,550L135,552L126,547L119,547L121,553L114,554L109,560L105,560L106,546L100,557L96,560L100,564L96,569L90,572L77,586L47,595L49,592L57,590L62,585L66,585L81,573L84,563L76,566L71,561L65,564L66,557L64,551L58,553L53,547L51,538L61,526L64,528L73,523L73,514L68,517L55,514L56,509ZM25,603L25,603L25,603ZM28,573L28,573L28,573ZM20,602L20,602L20,602ZM27,568L27,568L27,568ZM16,603L16,603L16,603ZM34,518L39,518L45,522L41,524ZM7,603L7,603L7,603ZM23,540L23,540L23,540ZM-0,602L-0,602L-0,602ZM-6,601L-6,601L-6,601ZM-10,599L-10,599L-10,599ZM-11,601L-11,601L-11,601ZM-15,601L-15,601L-15,601ZM-18,600L-18,600L-18,600ZM-20,597L-20,597L-20,597ZM-30,593L-30,593L-30,593ZM-35,593L-35,593L-35,593ZM-41,589L-41,589L-41,589ZM-56,577L-56,577L-56,577ZM-58,571L-58,571L-58,571ZM197,577L197,577L197,577ZM196,577L196,577L196,577ZM195,575L195,575L195,575ZM188,570L188,570L188,570ZM187,569L187,569L187,569ZM186,577L186,577L186,577ZM185,573L187,570L194,576L196,580ZM183,574L183,574L183,574ZM180,567L185,564L189,567ZM175,556L178,557L181,563L180,566ZM174,565L177,563L181,573ZM173,566L173,566L173,566ZM169,561L172,558L177,563L174,565ZM121,555L121,555L121,555ZM120,551L120,551L120,551Z","AZ":"M145,407L149,407L150,401L147,400L148,392L152,389L154,380L163,374L160,370L157,356L160,331L167,331L170,335L173,331L176,313L239,324L265,328L247,456L208,450L172,429L142,412Z","CO":"M277,237L333,244L361,247L395,249L394,272L390,341L372,339L349,338L315,334L265,328L268,299Z","FL":"M815,594L815,594L815,594ZM813,596L813,596L813,596ZM807,599L807,599L807,599ZM794,604L800,598L805,600ZM790,605L790,605L790,605ZM786,605L786,605L786,605ZM777,558L777,558L777,558ZM770,606L770,606L770,606ZM720,495L720,495L720,495ZM711,469L714,475L766,471L770,476L769,466L780,466L787,486L795,500L806,514L807,522L820,544L823,554L824,575L820,586L807,590L801,578L792,575L785,563L778,557L766,543L771,533L765,530L767,534L765,537L762,533L764,517L759,505L755,505L746,498L740,491L732,487L727,487L714,501L707,500L706,494L696,488L681,486L664,490L666,486L661,474Z","GA":"M689,380L713,377L735,374L732,382L741,385L748,396L762,406L766,412L771,414L774,423L786,435L783,442L781,454L778,460L780,466L769,466L770,476L766,471L714,475L711,469L708,465L709,457L706,450L710,440L702,427Z","IN":"M640,230L647,231L652,228L686,224L686,225L693,284L694,292L683,295L684,298L677,305L674,313L669,309L666,314L661,313L655,319L647,315L639,320L638,317L647,298L643,288L645,284Z","KS":"M394,272L422,273L465,275L510,275L516,278L514,286L519,293L522,295L523,344L489,344L433,343L390,341Z","ME":"M940,115L940,115L940,115ZM938,116L938,116L938,116ZM936,112L936,112L936,112ZM932,116L932,116L932,116ZM934,125L934,125L934,125ZM931,119L931,119L931,119ZM930,116L930,116L930,116ZM910,150L905,145L891,102L894,99L900,86L898,83L900,74L899,67L906,48L912,52L923,46L930,50L939,80L945,80L946,87L952,88L957,95L953,99L950,106L947,104L944,110L939,114L937,110L936,118L931,110L930,123L918,131L913,138Z","MA":"M928,187L928,187L928,187ZM918,188L921,184L925,187ZM871,168L884,165L903,161L909,155L914,158L909,166L917,171L922,178L931,177L920,183L918,179L913,186L911,183L910,182L905,176L899,178L871,184Z","MN":"M479,71L511,71L511,62L516,64L520,77L531,79L532,81L540,78L563,87L566,91L577,86L578,89L588,88L596,91L582,98L559,119L560,121L556,122L556,136L551,139L548,147L551,150L550,154L549,166L564,175L565,178L572,182L576,193L549,194L491,195L491,154L484,147L489,140L489,131L486,123L485,102L481,89L481,78Z","NJ":"M849,246L850,244L851,241L861,231L854,226L850,221L850,214L855,204L870,209L869,216L869,217L867,221L871,222L873,237L865,257L859,254L849,246Z","NC":"M864,329L864,329L864,329ZM863,350L863,350L863,350ZM756,334L780,331L812,326L859,316L856,317L859,323L847,333L856,330L863,329L866,335L860,344L843,343L854,347L850,356L859,354L856,361L851,361L844,365L834,377L833,384L823,386L798,368L778,371L772,365L749,367L735,374L713,377L713,371L717,369L721,363L726,362L738,350L741,351L747,345L751,346Z","ND":"M377,66L404,68L445,70L479,71L481,78L481,89L485,102L486,123L489,131L489,140L460,139L412,137L371,134Z","OK":"M372,339L390,341L433,343L489,344L523,344L523,355L527,381L526,421L520,418L512,413L499,415L492,420L481,414L476,419L467,413L462,413L454,409L452,411L438,404L429,403L424,398L426,354L372,351Z","PA":"M756,209L768,200L769,206L800,201L841,192L847,197L850,202L855,204L850,214L850,221L854,226L861,231L851,241L845,245L816,251L782,257L765,260L761,239Z","SD":"M369,156L371,134L412,137L460,139L489,140L484,147L491,154L491,195L488,195L491,204L488,212L491,218L476,210L467,210L466,212L457,206L404,204L365,201Z","TX":"M372,351L426,354L424,398L429,403L438,404L452,411L454,409L462,413L467,413L476,419L481,414L492,420L499,415L512,413L520,418L526,421L535,423L535,435L535,458L540,463L540,467L545,476L546,484L542,490L543,502L539,507L541,510L535,511L522,517L524,509L518,511L520,519L523,519L510,530L492,539L480,548L480,546L489,541L484,542L477,547L469,564L468,576L471,592L474,595L467,597L464,593L452,592L440,585L434,584L431,574L428,570L428,559L420,552L419,548L412,541L405,522L390,506L378,505L366,505L361,517L357,522L337,511L330,504L328,492L323,480L316,475L306,463L302,460L296,452L295,447L339,451L363,453L367,408L371,351Z","WY":"M369,156L365,201L361,247L333,244L277,237L244,232L247,210L256,154L258,142L298,148L339,153Z","CT":"M871,184L899,178L902,193L893,197L885,198L874,208L874,201Z","MO":"M502,262L521,262L545,261L571,260L576,265L576,273L578,280L590,290L591,297L601,298L598,313L614,326L614,333L621,340L620,349L617,351L616,351L615,352L612,363L600,364L605,357L604,352L550,355L523,355L523,344L522,295L519,293L514,286L516,278L510,275Z","WV":"M733,295L738,293L739,285L741,280L744,283L746,273L754,269L758,263L761,247L761,239L765,260L782,257L784,269L794,257L800,258L805,253L814,260L813,265L803,259L803,266L797,277L794,275L790,286L784,283L780,297L776,305L777,309L761,318L750,319L747,313L741,311L734,302Z","IL":"M576,265L577,259L581,258L584,248L582,241L593,236L596,224L587,215L634,212L634,217L640,230L645,284L643,288L647,298L638,317L639,320L639,327L632,330L632,337L624,334L621,340L614,333L614,326L598,313L601,298L591,297L590,290L578,280L576,273Z","NM":"M265,328L315,334L349,338L372,339L372,351L371,351L367,408L363,453L339,451L295,447L296,452L264,448L263,458L247,456Z","AR":"M523,355L550,355L604,352L605,357L600,364L612,363L613,367L605,378L607,383L603,387L598,393L599,400L595,402L593,409L590,411L592,415L588,420L591,430L589,433L535,435L535,423L526,421L527,381Z","CA":"M77,374L77,374L77,374ZM75,384L75,384L75,384ZM65,358L65,358L65,358ZM58,374L58,374L58,374ZM57,355L57,355L57,355ZM50,355L50,355L50,355ZM47,353L47,353L47,353ZM33,160L84,175L100,179L83,246L157,356L160,370L163,374L154,380L152,389L148,392L147,400L150,401L149,407L145,407L99,402L98,398L99,388L97,382L86,370L82,369L82,362L76,362L70,357L65,349L49,344L46,340L50,328L46,325L47,321L42,313L35,296L36,289L40,286L31,274L33,261L38,270L36,257L33,260L29,255L27,243L20,229L24,209L18,197L19,193L27,184L31,173Z","DE":"M849,246L849,246L849,246ZM845,245L851,241L850,244L849,249L855,258L861,263L864,270L853,273Z","DC":"M826,267L828,270L826,267Z","HI":"M305,584L310,578L310,573L322,578L326,584L332,589L329,593L317,598L314,603L309,600L309,594ZM292,558L294,555L306,561L305,564L299,566ZM292,567L292,567L292,567ZM284,558L284,558L284,558ZM279,554L280,551L291,553L288,555ZM258,543L265,540L271,549L262,549ZM226,533L231,528L235,529L236,534L230,536ZM216,537L216,537L216,537Z","IA":"M491,195L549,194L576,193L579,199L577,202L580,211L587,215L596,224L593,236L582,241L584,248L581,258L577,259L576,265L571,260L545,261L521,262L502,262L497,234L491,218L488,212L491,204L488,195Z","KY":"M621,340L624,334L632,337L632,330L639,327L639,320L647,315L655,319L661,313L666,314L669,309L674,313L677,305L684,298L683,295L694,292L693,284L699,283L704,290L714,293L721,292L727,288L733,295L734,302L741,311L747,313L741,320L735,325L729,334L720,339L704,341L672,343L645,346L641,350L617,351L620,349ZM616,351L615,352L616,351Z","MD":"M850,285L849,285L850,285ZM847,281L847,281L847,281ZM782,257L816,251L845,245L853,273L864,270L863,280L855,284L852,285L848,276L846,279L841,274L846,271L839,266L842,252L837,254L838,263L836,269L844,284L835,282L830,278L827,280L827,274L828,270L826,267L814,260L805,253L800,258L794,257L784,269Z","MI":"M677,131L677,131L677,131ZM663,133L663,133L663,133ZM662,139L662,139L662,139ZM661,136L661,136L661,136ZM659,142L659,142L659,142ZM657,150L657,150L657,150ZM655,153L655,153L655,153ZM646,140L646,140L646,140ZM652,228L659,216L660,205L659,198L652,184L652,175L655,168L655,160L661,154L664,148L664,156L668,153L667,146L674,142L670,138L675,133L685,135L687,138L697,140L701,147L699,149L702,154L702,162L699,169L695,171L694,177L699,180L705,171L710,168L715,172L722,191L721,200L716,199L715,207L708,222L686,225L686,224ZM601,92L610,86L610,89ZM585,123L594,117L601,116L619,101L624,100L615,112L628,114L633,121L644,121L652,115L662,114L670,111L670,118L676,118L683,115L684,121L694,128L681,129L676,127L674,131L671,128L663,127L661,130L653,131L638,140L632,153L631,148L627,147L628,140L623,135L612,134L607,131L590,128Z","MS":"M644,493L644,493L644,493ZM639,493L639,493L639,493ZM635,494L635,494L635,494ZM632,494L632,494L632,494ZM589,433L591,430L588,420L592,415L590,411L593,409L595,402L599,400L598,393L603,387L642,384L644,386L642,455L646,489L636,490L625,495L618,485L619,477L583,479L584,467L595,448L591,445L591,436Z","MT":"M198,39L233,46L265,52L303,57L340,62L377,66L371,134L369,156L339,153L298,148L258,142L256,154L253,148L250,151L237,148L235,151L225,149L224,142L219,139L215,118L208,123L205,120L209,114L208,109L213,96L209,96L201,80L195,74L197,69L193,62Z","NH":"M886,111L887,105L891,102L905,145L910,150L909,155L903,161L884,165L882,163L881,146L883,133L882,128L888,122Z","NY":"M899,196L899,196L899,196ZM897,198L897,198L897,198ZM869,217L867,221L869,217ZM816,154L816,154L816,154ZM814,154L814,154L814,154ZM768,200L776,192L780,186L775,176L784,172L796,170L800,172L809,169L819,161L815,150L815,146L820,141L829,128L832,124L858,118L862,134L861,140L864,149L867,150L871,168L871,184L874,201L874,208L891,204L895,200L900,202L886,213L872,219L869,216L870,209L855,204L850,202L847,197L841,192L800,201L769,206Z","OH":"M721,223L721,223L721,223ZM719,222L719,222L719,222ZM686,225L708,222L718,225L719,224L726,227L733,223L738,223L748,213L756,209L761,239L761,247L758,263L754,269L746,273L744,283L741,280L739,285L738,293L733,295L727,288L721,292L714,293L704,290L699,283L693,284Z","OR":"M71,70L77,74L80,80L79,87L86,91L98,91L103,95L112,94L139,95L171,102L176,112L157,137L162,143L158,150L149,191L100,179L84,175L33,160L31,157L34,146L33,140L45,121L57,92L65,71Z","TN":"M612,363L615,352L616,351L617,351L641,350L645,346L672,343L704,341L720,339L756,334L751,346L747,345L741,351L738,350L726,362L721,363L717,369L713,371L713,377L689,380L642,384L603,387L607,383L605,378L613,367Z","UT":"M198,201L247,210L244,232L277,237L268,299L265,328L239,324L176,313Z","VA":"M855,284L863,280L858,288L857,301L853,301L853,292ZM850,285L849,285L850,285ZM747,313L750,319L761,318L777,309L776,305L780,297L784,283L790,286L794,275L797,277L803,266L803,259L813,265L814,260L826,267L828,270L827,274L825,279L830,279L832,283L838,283L846,287L849,305L846,310L855,308L859,316L812,326L780,331L756,334L720,339L729,334L735,325L741,320Z","WA":"M93,51L93,51L93,51ZM99,25L99,25L99,25ZM99,20L99,20L99,20ZM98,23L98,23L98,23ZM95,31L95,31L95,31ZM96,18L96,18L96,18ZM94,20L94,20L94,20ZM95,13L95,13L95,13ZM91,21L98,22L96,27ZM91,19L91,19L91,19ZM184,36L171,92L171,102L139,95L112,94L103,95L98,91L86,91L79,87L80,80L77,74L71,70L66,69L64,65L66,57L71,54L67,51L68,34L66,23L70,20L77,27L90,33L95,33L97,39L92,52L96,52L98,42L102,38L101,27L102,21L100,14L140,25Z","WI":"M642,146L642,146L642,146ZM636,150L636,150L636,150ZM584,113L584,113L584,113ZM583,116L583,116L583,116ZM581,115L581,115L581,115ZM580,117L580,117L580,117ZM580,114L580,114L580,114ZM579,113L579,113L579,113ZM579,118L579,118L579,118ZM576,114L576,114L576,114ZM560,121L568,120L576,115L580,120L585,123L590,128L607,131L612,134L623,135L628,140L627,147L631,148L632,153L629,157L626,166L628,166L636,157L642,148L635,165L635,174L632,181L633,185L631,195L634,206L634,212L587,215L580,211L577,202L579,199L576,193L572,182L565,178L564,175L549,166L550,154L551,150L548,147L551,139L556,136L556,122Z","NE":"M365,201L404,204L457,206L466,212L467,210L476,210L491,218L497,234L502,262L510,275L465,275L422,273L394,272L395,249L361,247Z","SC":"M735,374L749,367L772,365L778,371L798,368L823,386L816,392L814,404L801,419L792,424L793,427L786,435L774,423L771,414L766,412L762,406L748,396L741,385L732,382Z","ID":"M171,102L171,92L184,36L198,39L193,62L197,69L195,74L201,80L209,96L213,96L208,109L209,114L205,120L208,123L215,118L219,139L224,142L225,149L235,151L237,148L250,151L253,148L256,154L247,210L198,201L149,191L158,150L162,143L157,137L176,112Z","NV":"M100,179L149,191L198,201L176,313L173,331L170,335L167,331L160,331L157,356L83,246Z","VT":"M858,118L886,111L888,122L882,128L883,133L881,146L882,163L884,165L871,168L867,150L864,149L861,140L862,134Z","LA":"M638,497L638,497L638,497ZM629,498L629,498L629,498ZM624,510L624,510L624,510ZM610,521L610,521L610,521ZM606,521L606,521L606,521ZM602,522L602,522L602,522ZM577,511L577,511L577,511ZM535,435L589,433L591,436L591,445L595,448L584,467L583,479L619,477L618,485L625,495L619,499L624,502L626,498L628,501L627,507L623,508L626,513L632,514L634,522L624,516L620,515L613,521L608,515L601,523L590,517L584,508L579,506L571,513L554,508L541,510L539,507L543,502L542,490L546,484L545,476L540,467L540,463L535,458Z","RI":"M911,183L913,186L911,183ZM908,188L908,188L908,188ZM907,196L907,196L907,196ZM902,193L899,178L905,176L910,182L907,181L908,191Z"};
const US_CEN={"AL":[672,432],"AK":[103,523],"AZ":[208,382],"CO":[332,290],"FL":[767,516],"GA":[736,428],"IN":[665,269],"KS":[456,309],"ME":[919,94],"MA":[897,172],"MN":[525,132],"NJ":[861,230],"NC":[801,351],"ND":[429,104],"OK":[471,376],"PA":[806,226],"SD":[430,172],"TX":[434,469],"WY":[308,195],"CT":[886,190],"MO":[560,312],"WV":[766,285],"IL":[615,270],"NM":[311,393],"AR":[564,391],"CA":[82,288],"DE":[854,261],"DC":[827,268],"HI":[301,574],"IA":[540,227],"KY":[688,321],"MD":[832,263],"MI":[670,167],"MS":[618,437],"MT":[287,100],"NH":[893,141],"NY":[834,172],"OH":[724,253],"OR":[103,134],"TN":[673,361],"UT":[227,269],"VA":[803,304],"WA":[124,59],"WI":[595,167],"NE":[434,239],"SC":[780,393],"ID":[199,147],"NV":[142,252],"VT":[873,136],"LA":[576,478],"RI":[904,184]};
/* ================= Events ================= */
const EVENTS=[
 {id:'hurricane',t:'Hurricane slams the Gulf Coast',x:'A Category 4 storm hits Louisiana and Mississippi. Your campaign has a rally scheduled two states over, featuring a confetti cannon you already paid for.',c:[
  {l:'Cancel the rally and help with relief',fx:{mom:2,cred:3,cash:-1,blocs:{senior:2,suburb:2}},r:'You hand out water for six hours. The confetti cannon is donated to a children’s hospital.'},
  {l:'Unveil a climate resilience plan',fx:{issue:[4,-1],blocs:{prog:3,young:3,rural:-2}},r:'Environmental groups cheer. Oil country changes the channel.'},
  {l:'Keep the rally. Fire the confetti.',fx:{mom:-3,cred:-4,blocs:{suburb:-3}},r:'Cable news runs your confetti next to flood footage on a split screen for 48 hours.'}]},
 {id:'factory',t:'Plant closing ships 2,000 jobs overseas',x:'A beloved appliance plant in Ohio is moving production abroad. The CEO announced it from a yacht.',c:[
  {l:'Promise tariffs to bring jobs home',fx:{cred:1,blocs:{union:5,rural:2,biz:-3}},r:'Union halls love it. Economists write very long threads.'},
  {l:'Pitch a job retraining program',fx:{blocs:{suburb:2,union:1,young:1}},r:'Sensible, popular, and instantly forgotten by the news cycle.'},
  {l:'Say the market has spoken',fx:{mom:-1,blocs:{biz:4,union:-6}},r:'Business owners nod. Ohio does not.'}]},
 {id:'shooting',t:'Mass shooting at a shopping center',x:'A gunman kills several people at a shopping center in a swing-state suburb. The country is grieving, and every candidate is asked what they would do.',c:[
  {l:'Call for stricter gun laws',fx:{issue:[3,-1],blocs:{suburb:2,prog:3,rural:-3}},r:'You meet with the victims’ families and lay out a legislative plan.'},
  {l:'Focus on mental health and school security',fx:{blocs:{senior:1,suburb:1}},r:'You announce funding for mental health services and security grants.'},
  {l:'Defend gun rights while offering condolences',fx:{issue:[3,1],blocs:{rural:3,prog:-3,suburb:-1}},r:'You attend a vigil and argue that new restrictions would not have prevented the attack.'}]},
 {id:'court',t:'Supreme Court rules on a state abortion law',x:'A major ruling lands mid-campaign, and reporters want your reaction within the hour.',c:[
  {l:'Promise to protect access nationwide',fx:{issue:[6,-1],blocs:{prog:3,young:3,suburb:2,faith:-4}},r:'Turnout groups on one side start fundraising off your quote.'},
  {l:'Say it should be left to the states',fx:{blocs:{suburb:1,faith:-1,prog:-2}},r:'Both sides accuse you of dodging. The polls barely move.'},
  {l:'Promise new federal restrictions',fx:{issue:[6,1],blocs:{faith:4,rural:2,suburb:-3,young:-3}},r:'Turnout groups on the other side start fundraising off your quote.'}]},
 {id:'dance',t:'Video of you dancing at a wedding goes viral',x:'Someone filmed you attempting the worm at your cousin’s wedding. It has 40 million views and three remixes.',c:[
  {l:'Lean in: post your own dance remix',fx:{mom:3,blocs:{young:4,senior:-1}},r:'Your remix outperforms your health care plan by 900%. Staff is conflicted.'},
  {l:'Ignore it and talk about policy',fx:{},r:'The internet moves on in four days. You remain “the worm guy” forever.'},
  {l:'Claim it’s a deepfake',fx:{cred:-6,mom:-2},r:'Your cousin posts the uncut 14-minute version. The worm was even worse in full.'}]},
 {id:'border',t:'Border crossings hit a monthly record',x:'New numbers show a sharp spike in border crossings, and every network has a reporter standing in front of a fence.',c:[
  {l:'Call for more agents and a crackdown',fx:{issue:[2,1],blocs:{rural:3,senior:2,prog:-3}},r:'You tour the border in a tactical vest that still has the tag on it.'},
  {l:'Push expanded legal pathways',fx:{issue:[2,-1],blocs:{prog:3,young:2,rural:-3}},r:'Advocacy groups praise you. Border-state talk radio does not.'},
  {l:'Pitch a grand bipartisan deal',fx:{cred:-1,blocs:{suburb:3,biz:1}},r:'Everyone agrees a deal would be great. Nobody agrees on the deal.'}]},
 {id:'gas',t:'Gas prices jump 80 cents in a month',x:'Drivers are furious, and someone is selling “I did that” stickers with your face on them. Also everyone else’s.',c:[
  {l:'Open up more drilling',fx:{issue:[4,1],blocs:{rural:3,union:2,young:-3}},r:'Oil executives send a fruit basket. Climate activists send a different basket.'},
  {l:'Propose a gas tax holiday',fx:{cred:-2,blocs:{suburb:3,senior:1}},r:'Voters like it. Every economist on Earth calls it a gimmick.'},
  {l:'Promise electric vehicle incentives',fx:{issue:[4,-1],blocs:{young:3,prog:2,rural:-2}},r:'Great news for anyone who can afford a new car.'}]},
 {id:'superpac',t:'A billionaire offers you a $15 million super PAC',x:'The money comes with one “suggestion”: go easier on taxes for people like him.',c:[
  {l:'Take the money and soften on taxes',fx:{cash:15,issue:[0,1],blocs:{prog:-4,young:-2,biz:2}},r:'Your ad budget explodes. So does your inbox.'},
  {l:'Turn it down publicly',fx:{mom:2,blocs:{prog:3,young:2,union:2}},r:'“Not for sale” becomes a T-shirt. The T-shirts sell very well.'},
  {l:'Take it quietly',fx:{cash:12,exposure:20},r:'Nobody knows. Yet. A reporter has started asking about shell companies.'}]},
 {id:'corndog',t:'You’re at the state fair and handed a corn dog',x:'Forty cameras are pointed at your mouth. History is watching.',c:[
  {l:'Eat it with a knife and fork',fx:{mom:-2,blocs:{rural:-3}},r:'The fork footage plays on loop. A farmer is heard saying “bless his heart.”'},
  {l:'Take the deep-fried butter challenge too',fx:{mom:2,blocs:{rural:3,senior:1}},r:'You finish the butter. A legend is born. Your cardiologist issues a statement.'},
  {l:'Give a speech about farm subsidies',fx:{blocs:{rural:2,biz:1}},r:'Solid policy, delivered with mustard on your lapel the entire time.'}]},
 {id:'strike',t:'Autoworkers go on strike',x:'Forty thousand workers walk off the job across Michigan and Ohio. Both sides want you to pick one.',c:[
  {l:'Join the picket line',fx:{blocs:{union:6,young:1,biz:-3}},r:'You hold a sign and a bullhorn. You use the bullhorn a little too much.'},
  {l:'Urge both sides to negotiate',fx:{blocs:{suburb:1}},r:'A statement so balanced nobody quotes it.'},
  {l:'Side with the automakers',fx:{blocs:{biz:3,union:-6}},r:'Business groups applaud. Michigan union halls take your photo off the wall.'}]},
 {id:'strait',t:'Standoff erupts in a key shipping lane',x:'A hostile navy has blockaded a strait that carries a fifth of the world’s oil. Allies want to know what America would do under you.',c:[
  {l:'Send a carrier group',fx:{issue:[8,1],blocs:{senior:3,rural:2,young:-2}},r:'You look very presidential in front of a map. Oil markets calm down a little.'},
  {l:'Call for an emergency diplomatic summit',fx:{issue:[8,-1],blocs:{prog:2,young:2,senior:-1}},r:'Foreign policy experts nod. Hawks call you “summit-curious.”'},
  {l:'Say it’s not America’s problem',fx:{cred:-2,blocs:{young:2,senior:-3}},r:'Allies leak their alarm to the press. Some voters love it anyway.'}]},
 {id:'crime',t:'Crime spike leads the evening news',x:'Several big cities report a jump in car thefts and robberies, and a local anchor calls it “a crisis.”',c:[
  {l:'Fund 100,000 new police officers',fx:{issue:[5,1],blocs:{senior:3,suburb:2,prog:-3}},r:'Police unions endorse you on the spot.'},
  {l:'Push community programs and police reform',fx:{issue:[5,-1],blocs:{prog:3,young:2,senior:-2}},r:'Reform advocates cheer. Your opponent’s ad team starts editing.'},
  {l:'Do both: more officers, more oversight',fx:{cred:-1,blocs:{suburb:3}},r:'Reasonable. Both sides call it mush.'}]},
 {id:'loans',t:'Court blocks student debt relief',x:'A federal court strikes down a student debt relief program. Millions of borrowers want to know where you stand.',c:[
  {l:'Promise to cancel student debt',fx:{issue:[7,-1],blocs:{young:5,prog:2,biz:-2,senior:-1}},r:'Campus rallies triple in size. So do the angry op-eds.'},
  {l:'Oppose cancellation',fx:{issue:[7,1],blocs:{biz:2,rural:2,young:-4}},r:'“I paid mine off” voters feel seen.'},
  {l:'Propose an interest freeze instead',fx:{blocs:{young:2,suburb:1}},r:'A compromise with exactly zero viral potential.'}]},
 {id:'tweets',p:'gen',t:'Your running mate’s old posts resurface',x:'Someone dug up {vp}’s posts from 2011. They include strong opinions about a reality show and one very bad joke.',c:[
  {l:'Stand by {vp}',fx:{cred:-2,mom:-2},r:'You call it old news. The news disagrees.'},
  {l:'Have {vp} apologize on TV',fx:{mom:-1,blocs:{suburb:1}},r:'The apology is sincere, long, and rated PG-13.'},
  {l:'Say the account was hacked',fx:{cred:-5},r:'The hacker apparently hacked 400 of {vp}’s posts over seven years.'}]},
 {id:'milk',t:'You couldn’t name the price of milk',x:'A reporter asked. You said “eleven dollars?” {opp}’s campaign already has an ad running.',c:[
  {l:'Do a grocery store tour',fx:{cash:-0.5,blocs:{senior:2,suburb:1}},r:'You learn the price of milk and, alarmingly, of eggs.'},
  {l:'Hit back with an attack ad',fx:{cash:-3,mom:2},r:'Your ad reveals {opp} once expensed a $900 sandwich. A truce is declared.'},
  {l:'Double down: “Premium milk, folks.”',fx:{mom:-3,blocs:{union:-2}},r:'“Premium milk” trends for a week. It is not a compliment.'}]},
 {id:'latenight',p:'gen',t:'A late-night comedy show invites you on',x:'They want you for a sketch where you play yourself, badly.',c:[
  {l:'Do the sketch and roast yourself',fx:{mom:2,blocs:{young:4,senior:-1}},r:'You turn out to be funny. Nobody is more surprised than your staff.'},
  {l:'Decline: “The presidency isn’t a joke”',fx:{blocs:{senior:2,young:-2}},r:'The show does the sketch anyway, with a cardboard cutout of you.'},
  {l:'Send {vp} instead',fx:{blocs:{young:1}},r:'{vp} kills. You are briefly jealous.'}]},
 {id:'general',t:'A popular retired general offers an endorsement',x:'The catch: a public pledge to raise defense spending.',c:[
  {l:'Accept and make the pledge',fx:{cred:2,issue:[8,1],blocs:{senior:3,rural:2,prog:-2}},r:'The general’s handshake leaves a mark. So does the endorsement.'},
  {l:'Decline politely',fx:{blocs:{prog:1}},r:'The general endorses {opp} instead. The handshake photos are intense.'}]},
 {id:'insulin',t:'A story about insulin prices goes viral',x:'A teacher in Arizona has been rationing her insulin, and her story is everywhere.',c:[
  {l:'Promise federal price caps',fx:{issue:[1,-1],blocs:{senior:3,suburb:2,biz:-2}},r:'The teacher thanks you on air. Drug company stocks dip.'},
  {l:'Promise more competition to lower prices',fx:{issue:[1,1],blocs:{biz:3,senior:1}},r:'Free-market groups applaud. Price drops are “expected eventually.”'},
  {l:'Promise an executive order on day one',fx:{cred:-1,blocs:{suburb:2,senior:2}},r:'Legal scholars note the order would get sued by day two.'}]},
 {id:'techbro',t:'A tech billionaire endorses you, unprompted',x:'In the same post, he said the moon “should be privatized.”',c:[
  {l:'Embrace the endorsement',fx:{cash:6,mom:1,blocs:{suburb:-3,young:1}},r:'Donations flood in. So do questions about the moon.'},
  {l:'Publicly distance yourself',fx:{mom:-1,blocs:{suburb:2}},r:'He posts that you are “mid.” Your approval ticks up anyway.'},
  {l:'Say you’re “open” to privatizing the moon',fx:{mom:3,cred:-4},r:'An instant viral moment. NASA declines to comment.'}]},
 {id:'bus',t:'Your campaign bus breaks down in Pennsylvania',x:'You’re stranded outside Scranton with the press pool and a cooler of sandwiches.',c:[
  {l:'Hitch a ride on a farm truck',fx:{mom:3,blocs:{rural:2,union:1}},r:'The photo becomes the most iconic image of your campaign.'},
  {l:'Call in a chauffeured SUV',fx:{cred:-1,blocs:{union:-2}},r:'The SUV arrives with heated seats and a mini fridge. Cameras film everything.'},
  {l:'Hand out the sandwiches to locals',fx:{blocs:{union:2,senior:1}},r:'Good vibes. Mediocre sandwiches.'}]},
 {id:'groupchat',t:'Your staff group chat leaks',x:'A staffer called {bloc} “basically a lost cause” in a group chat that somehow included a reporter.',c:[
  {l:'Fire the staffer immediately',fx:{cred:2,mom:-1,blocs:{$:1}},r:'Swift and decisive. The staffer gets a book deal.'},
  {l:'Apologize personally to {bloc}',fx:{mom:-1,blocs:{$:3}},r:'You go on a listening tour. You do, in fact, listen.'},
  {l:'Claim the chat is fake',fx:{cred:-5,blocs:{$:-3}},r:'The reporter publishes the screenshots, with timestamps.'}]},
 {id:'recession',t:'Economists warn of a recession',x:'Three bad jobs reports and an inverted yield curve, which nobody understands but everybody fears.',c:[
  {l:'Propose a major stimulus package',fx:{issue:[0,-1],blocs:{union:3,young:2,biz:-2}},r:'Cash for families, roads for everyone, and a deficit for later.'},
  {l:'Propose sweeping tax cuts',fx:{issue:[0,1],blocs:{biz:4,prog:-3}},r:'Markets rally. Deficit hawks quietly sob.'},
  {l:'Blame the people in charge',fx:{mom:1,cred:-1},r:'Effective, if not exactly a plan.'}]},
 {id:'protest',t:'Climate protesters storm your rally',x:'Activists chain themselves to your podium. One is gluing his hand to your teleprompter.',c:[
  {l:'Invite them on stage to speak',fx:{blocs:{prog:4,young:2,rural:-3}},r:'A tense but memorable moment. The glue guy is still stuck.'},
  {l:'Have security remove them',fx:{blocs:{rural:2,senior:1,young:-4}},r:'The footage is not great. The teleprompter is never the same.'},
  {l:'Promise to declare a climate emergency',fx:{issue:[4,-1],blocs:{prog:3,young:3,union:-2,rural:-3}},r:'They unchain themselves and applaud. Oil states take notes.'}]},
 {id:'union',t:'A major union weighs its endorsement',x:'The union president wants your promise to sign a labor rights bill.',c:[
  {l:'Promise to sign the bill',fx:{blocs:{union:5,biz:-3}},r:'You get the endorsement and 50,000 door-knockers.'},
  {l:'Promise to “study it closely”',fx:{blocs:{union:-2,biz:1}},r:'The union endorses nobody. Hard feelings all around.'}]},
 {id:'podcast',t:'America’s biggest podcast wants a three-hour interview',x:'The host is known for asking about aliens, cold plunges, and the Roman Empire.',c:[
  {l:'Do all three hours',fx:{mom:2,gaffe:0.35,blocs:{young:4,rural:1}},r:'You talk about aliens for 40 minutes. Young men are oddly persuaded.'},
  {l:'Do a tight 30 minutes',fx:{blocs:{young:2}},r:'Safe. The host calls you “guarded but chill.”'},
  {l:'Decline',fx:{blocs:{young:-2}},r:'The host spends a whole episode speculating about why you declined.'}]},
 {id:'establishment',p:'primary',t:'Party insiders hint they prefer a rival',x:'Anonymous “party insiders” tell reporters that {opp} is “more electable.”',c:[
  {l:'Court the party establishment',fx:{cash:5,cred:1,mom:-1},r:'The donor class warms to you. The base side-eyes you.'},
  {l:'Run against the establishment',fx:{mom:3,cash:-1},r:'“They’re scared of us” becomes your rally chant.'}]},
 {id:'straw',p:'primary',t:'You lose a straw poll to a write-in',x:'At a county party picnic, a write-in for “literally anyone else” beats you by 12 votes.',c:[
  {l:'Laugh it off online',fx:{mom:1,blocs:{young:1}},r:'Self-deprecation lands. “Literally Anyone Else” drops out.'},
  {l:'Demand a recount',fx:{mom:-2,cred:-2},r:'The recount finds three more votes for “literally anyone else.”'}]}
];

/* ================= Debates ================= */
const ISSUE_LINES=[
 {L:'Make the wealthiest pay their fair share and put it into families and roads.',C:'Close the loopholes, cut the waste, and keep middle-class taxes steady.',R:'Cut taxes across the board and make Washington live within its means.'},
 {L:'Healthcare is a right. I’d move us to a system that covers everyone.',C:'Keep what works, cap costs, and make sure nobody goes broke getting sick.',R:'More competition, more choice, and less government between you and your doctor.'},
 {L:'Secure the border with smart technology and open real legal paths to citizenship.',C:'Fund enforcement and fix the legal system at the same time.',R:'Shut down illegal crossings first. Enforcement isn’t optional.'},
 {L:'Universal background checks and an assault weapons ban.',C:'Respect the Second Amendment and close the background check gaps.',R:'The Second Amendment isn’t up for negotiation. Go after criminals, not owners.'},
 {L:'Go all in on clean energy and the jobs that come with it.',C:'An all-of-the-above plan that keeps the lights on while we transition.',R:'Unleash American oil and gas and bring prices down now.'},
 {L:'Invest in prevention and hold bad officers accountable.',C:'Fund the police and demand accountability. Both.',R:'Back the police, prosecute crime, and make our streets safe again.'},
 {L:'That decision belongs to a woman and her doctor.',C:'I’d leave it to the states and protect access in medical emergencies.',R:'I’ll defend life and support reasonable national limits.'},
 {L:'Fully fund public schools and cancel crushing student debt.',C:'Raise teacher pay and cap student loan interest.',R:'Let parents choose their kids’ schools. No bailouts for loans.'},
 {L:'Strong alliances and diplomacy first. War is the last resort.',C:'Keep our alliances strong and our military ready.',R:'Peace through strength. Adversaries respect power, not summits.'}
];
const ATTACK_LINES=['{opp} can’t even explain their own budget. I read it. It’s mostly vibes.','{opp} has had ten years to fix healthcare and fixed exactly nothing.','{opp} has changed positions on the border more times than the border has moved.','{opp} talks tough on this every election and forgets it every January.','{opp}’s energy plan would turn your power bill into a horror movie.','Things got worse everywhere {opp} had a say. Look it up.','{opp} has been on every side of this issue except the honest one.','{opp} wants to grade our schools. Here’s their grade: incomplete.','{opp} couldn’t find our allies on a map with a GPS and an intern.'];
const JOKE_LINES=['My plan pays for itself. Like my gym membership. In theory.','My healthcare plan? Step one: nobody gets sick until after the election.','My immigration plan is simple: anyone who can assemble flat-pack furniture gets a fast track.','I grew up in a family where the most dangerous weapon was my aunt’s casserole.','I drive a hybrid. Half guilt, half gas.','I’m so tough on crime I once returned a library book on time.',null,'My student loans are so old they qualify for Social Security.','My foreign policy: be the friend who brings snacks, but also owns a very large dog.'];
const DQ=[
 {type:'policy',issue:0,t:'Walk us through how you’d pay for your economic plan.'},
 {type:'policy',issue:1,t:'Millions of Americans are drowning in medical bills. What exactly would you do?'},
 {type:'policy',issue:2,t:'What is your plan for the southern border, in specifics?'},
 {type:'policy',issue:4,t:'What would you do about energy prices and climate change?'},
 {type:'policy',issue:8,t:'A foreign adversary tests a new missile tomorrow. What do you do?'},
 {type:'policy',issue:5,t:'Crime is up in several cities. What changes on your first day?'},
 {type:'policy',issue:7,t:'Should taxpayers help with student debt?'},
 {type:'policy',issue:3,t:'After another mass shooting, what would you actually do about guns?'},
 {type:'attack',t:'{opp} says your record “reads like a ransom note.” Your response?',a:[
   ['attack','A ransom note at least makes a clear demand. {opp}’s plans don’t even manage that.'],
   ['message','Voters can read my record. Here’s what I’ll do for your family on day one.'],
   ['joke','If my record’s a ransom note, the hostage is the middle class, and the ransom is cheaper groceries.'],
   ['policy','Let’s go line by line. Here are the three bills I’d sign first.']]},
 {type:'attack',t:'{opp} just called you “a weather vane in a nice suit.” Respond.',a:[
   ['attack','Better a weather vane than a brick. {opp} hasn’t had a new idea since flip phones.'],
   ['message','I listen to voters. That’s not a weakness, it’s the job.'],
   ['joke','A weather vane in a nice suit? Thank you for noticing the suit.']]},
 {type:'gotcha',t:'Can you name the prime minister of a country you’ve never visited?',a:[
   ['message','I won’t play trivia with national security. I’ll tell you how I’d lead.'],
   ['joke','I can name every snack in the green room, which is about the same level of preparation as this question.'],
   ['policy','I’ll name our five closest allies and what each one needs from us.'],
   ['attack','The real question is whether {opp} could find that country on a map.']]},
 {type:'gotcha',t:'Yes or no: have you ever changed a position for political gain?',a:[
   ['message','I’ve grown on some issues, and I’ll own that. Here’s where I stand now.'],
   ['attack','Happy to compare records. {opp}’s has more U-turns than a parking garage.'],
   ['joke','Only once, and it was about pineapple on pizza.'],
   ['policy','Here’s my record, issue by issue.']]},
 {type:'personal',t:'What is your biggest weakness? Please don’t say “caring too much.”',a:[
   ['joke','I can’t parallel park. That’s why I want the job that comes with a driver.'],
   ['message','I push too hard sometimes. That’s exactly why I’ll fight for you.'],
   ['attack','My biggest weakness is being too nice to {opp}.']]},
 {type:'personal',t:'Name one thing you admire about {opp}.',a:[
   ['joke','I admire {opp}’s confidence. Unearned, but inspiring.'],
   ['message','{opp} loves this country. We just disagree on how to serve it.'],
   ['policy','Their work on veterans’ care was good, and I’d build on it.'],
   ['attack','Honestly? Nothing comes to mind.']]}
];
const FIT={recent:{message:.12,policy:.08,attack:-.05,joke:0},policy:{policy:.15,message:.05,attack:-.05,joke:-.1,pivot:.1},attack:{joke:.15,attack:.1,message:0,policy:-.1},gotcha:{message:.15,joke:.05,policy:-.1,attack:-.05},personal:{joke:.15,message:.05,policy:0,attack:-.15}};
const STYLE_NAME={policy:'Your platform',attack:'Attack',message:'Stay on message',joke:'Joke',pivot:'Move to the middle'};
const STYLE_OUT={
 attack:['You land a clean shot. {opp} blinks first.','Your attack misses, and the crowd groans.'],
 message:['You stay steady and on message. Voters nod along.','The pivot is so obvious the moderator calls it out.'],
 policy:['You lay out the details with total command.','You get lost in the weeds and start citing subsection numbers.'],
 pivot:['Moderates in the focus group perk up.','The flip is obvious, and {opp} pounces.'],
 joke:['The crowd laughs. That’s the clip of the night.','The joke dies on stage. Somewhere, a cricket chirps.']
};

/* ================= New content (v3) ================= */
const bio=()=>P().bio||{};
const flagAge=(k,min)=>G.flags&&G.flags[k]!==undefined&&(G.week-G.flags[k])>=(min||2);
const MORE_EVENTS=[
 // ---- cheeky ----
 {id:'holidayinn',tone:'cheeky',t:'A “very friendly” Holiday Inn story',x:'Your former bus driver tells a tabloid you were “very friendly” with your scheduler at a Des Moines Holiday Inn. He also says you hogged the ice machine.',c:[
  {l:'Deny it flatly',fx:{cred:-2,setFlag:'holidayinn'},r:'The story fades. For now. The tabloid’s editor has started saving receipts.'},
  {l:'Admit you’re close friends who love ice',fx:{mom:-1,blocs:{young:2},setFlag:'holidayinn_soft'},r:'“Ice Machine Gate” trends for a day. Nobody is sure what it means.'},
  {l:'Fire the bus driver',fx:{mom:-2,blocs:{union:-3}},r:'The bus driver gets a podcast. It is very popular.'}]},
 {id:'holidayinn2',tone:'cheeky',req:()=>flagAge('holidayinn',3),t:'The Holiday Inn receipts surface',x:'The tabloid publishes a receipt: one room, two robes, and forty-one bags of ice. Your denial is now the story.',c:[
  {l:'Apologize to your family on TV',fx:{cred:-4,mom:-2,blocs:{faith:-2}},r:'Your spouse sits beside you, expressionless. The clip gets 30 million views.'},
  {l:'Insist it was a “staff ice-bonding retreat”',fx:{cred:-7,blocs:{young:2}},r:'Your staff denies the retreat existed. One staffer denies being on staff.'},
  {l:'Change the subject to the economy',fx:{cred:-3,mom:-1},r:'It almost works, until a reporter asks if the economy also needs forty-one bags of ice.'}]},
 {id:'thirst',tone:'cheeky',t:'A thirst trap from your past',x:'A 2009 calendar shoot resurfaces: you, shirtless, holding a golden retriever and a fire hose. The internet has opinions.',c:[
  {l:'Own it: “I looked great.”',fx:{mom:3,blocs:{young:3,faith:-2}},r:'The calendar sells out on eBay. The golden retriever gets an agent.'},
  {l:'Say it was for charity (it was)',fx:{cred:2,blocs:{suburb:1}},r:'It raised $4,000 for a fire station. Reporters are almost disappointed.'},
  {l:'Recreate it for 2028',fx:{mom:2,cred:-3,blocs:{young:2,senior:-2}},r:'Same dog. Same hose. Your campaign manager quietly updates her résumé.'}]},
 {id:'hotmic',tone:'cheeky',t:'Hot mic catches you rating the buffet',x:'A live mic caught you telling a donor the shrimp at a fundraiser was “honestly the best thing about this state.”',c:[
  {l:'Lean in: tour the state’s best shrimp',fx:{mom:1,blocs:{biz:2}},r:'Local seafood shacks report record business. You gain four pounds.'},
  {l:'Apologize to the entire state',fx:{cred:1,mom:-1},r:'The state accepts. The shrimp does not comment.'},
  {l:'Say the mic was “emotionally hacked”',fx:{cred:-4},r:'Tech experts confirm this is not a thing.'}]},
 {id:'dating',tone:'cheeky',req:()=>bio().marital==='single'||bio().marital==='divorced',t:'You’ve been spotted on a dating app',x:'Your profile says “Looking for someone to share long walks and a 4-year lease on public housing (the White House).” It has 2 million right swipes.',c:[
  {l:'Keep the profile up',fx:{mom:2,blocs:{young:4,faith:-2}},r:'You match with three senators, two governors, and a raccoon’s lawyer.'},
  {l:'Delete it and blame a staffer',fx:{cred:-2},r:'The staffer insists they would have written a better bio.'},
  {l:'Go on one date, livestreamed',fx:{mom:3,cred:-2,blocs:{young:3,senior:-2}},r:'The date goes fine. The comment section does not.'}]},
 {id:'spousetv',tone:'cheeky',req:()=>bio().marital==='celebspouse',t:'Your celebrity spouse goes off-script',x:'On a daytime talk show, your spouse reveals you “snore like a leaf blower” and “cry at car commercials.”',c:[
  {l:'Laugh along on social media',fx:{mom:2,blocs:{suburb:2,young:2}},r:'Leaf-blower memes everywhere. Your favorability ticks up.'},
  {l:'Have the campaign issue a correction',fx:{cred:-2},r:'The correction clarifies you snore like a “compact” leaf blower.'}]},
 // ---- absurd ----
 {id:'raccoon',tone:'absurd',t:'A raccoon has been living in your campaign HQ',x:'Staff discovered a raccoon has lived in the HQ ceiling for three weeks. Somehow it has a staff badge with the title “Senior Advisor.”',c:[
  {l:'Make it the official campaign mascot',fx:{mom:3,blocs:{young:3},setFlag:'raccoon'},r:'“Bandit” gets 1.2 million followers overnight. Merch drops at noon.'},
  {l:'Call animal control quietly',fx:{blocs:{suburb:1}},r:'Bandit is relocated. The badge is not recovered.'},
  {l:'Promote it to deputy campaign manager',fx:{mom:2,cred:-3,setFlag:'raccoon'},r:'Marge is not amused. Bandit takes the corner office.'}]},
 {id:'raccoon2',tone:'absurd',req:()=>flagAge('raccoon',3),t:'Bandit the raccoon has hired a lawyer',x:'Your mascot raccoon’s attorney claims Bandit is owed back pay, a pension, and “at least one rally speech.”',c:[
  {l:'Let Bandit speak at a rally',fx:{mom:4,cred:-2,blocs:{young:3}},r:'Bandit eats the teleprompter. Crowd goes wild. Ratings record.'},
  {l:'Settle out of court in grapes',fx:{cash:-1,blocs:{suburb:1}},r:'Three hundred pounds of grapes later, Bandit signs an NDA with a paw print.'},
  {l:'Countersue',fx:{mom:-2},r:'The judge rules for the raccoon. Nobody is surprised.'}]},
 {id:'twin',tone:'absurd',t:'Your opponent’s secret twin endorses you',x:'A man claiming to be {opp}’s identical twin brother, “Kevin,” holds a press conference endorsing you. Nobody knew Kevin existed. Including, apparently, {opp}.',c:[
  {l:'Accept Kevin’s endorsement',fx:{mom:3,cred:-2,opp:{mom:-2}},r:'Kevin campaigns for you in four states. People keep asking {opp} for autographs meant for Kevin.'},
  {l:'Politely decline: “Family matters are private”',fx:{cred:3},r:'Classy. Kevin endorses a mattress company instead.'}]},
 {id:'cheese',tone:'absurd',t:'A cheese sculpture of you is unveiled in Wisconsin',x:'A dairy cooperative carved a 9-foot statue of you out of cheddar. It is beautiful. It is melting.',c:[
  {l:'Hold a rally in front of it',fx:{mom:2,blocs:{rural:2,union:1}},r:'You give a speech as your cheese face slowly droops. Iconic.'},
  {l:'Eat a piece on camera',fx:{mom:3,blocs:{rural:3},cred:-1},r:'Cannibalism or campaigning? Philosophers weigh in.'},
  {l:'Request a gouda version',fx:{blocs:{biz:2,rural:-1}},r:'The cooperative is offended. They are very serious about cheddar.'}]},
 {id:'ghost',tone:'absurd',t:'A medium says a dead president endorses you',x:'A famous TV psychic announces that the ghost of a founding father has “strong opinions” and backs your campaign.',c:[
  {l:'Thank the ghost',fx:{mom:2,blocs:{senior:-1,young:2}},r:'Historians are furious. Ghost hunters donate $400,000.'},
  {l:'Ask the ghost to weigh in on taxes',fx:{mom:1,cred:-2},r:'The ghost says “no taxation without representation.” Everyone claims victory.'},
  {l:'Stay respectfully silent',fx:{cred:1},r:'The ghost endorses {opp} the next day. Fickle.'}]},
 {id:'meteor',tone:'absurd',t:'A tiny meteor hits your campaign bus',x:'A meteorite the size of a golf ball punched straight through your bus roof during a rally. Nobody was hurt. The bus is now a tourist attraction.',c:[
  {l:'Call it a sign from the heavens',fx:{mom:3,blocs:{faith:2},cred:-1},r:'Pilgrims arrive. The bus is booked through spring.'},
  {l:'Auction the meteorite',fx:{cash:4,blocs:{biz:1}},r:'A tech billionaire buys it to put on his own rocket. Full circle.'},
  {l:'Use it in a speech about the space program',fx:{blocs:{young:2,senior:1}},r:'NASA retweets you. A rare bipartisan moment.'}]},
 {id:'goat',tone:'absurd',t:'A goat eats your stump speech',x:'At a farm event in Iowa, a goat ate your only printed copy of your speech. You must now improvise for 25 minutes.',c:[
  {l:'Improvise from the heart',fx:{mom:2,blocs:{rural:2},gaffe:.25},r:'You speak for 25 minutes about your grandmother’s pie. It may be your best speech.'},
  {l:'Read your speech off the goat’s ear tag',fx:{mom:1,blocs:{young:2}},r:'It just says “GOAT 47.” You make it work.'},
  {l:'Blame the goat',fx:{blocs:{rural:-3},mom:-1},r:'Farmers do not like it when you blame goats.'}]},
 {id:'mascotfight',tone:'absurd',t:'Your mascot and {opp}’s mascot fight at a parade',x:'Your costumed eagle and {opp}’s costumed bulldog brawled on a float. The bulldog lost its head. Literally.',c:[
  {l:'Call for peace between mascots',fx:{cred:2},r:'A historic mascot ceasefire is signed on a napkin.'},
  {l:'Claim victory',fx:{mom:2,blocs:{young:2,senior:-1}},r:'“EAGLE WINS” trends worldwide. The bulldog’s head is still missing.'},
  {l:'Fire your eagle',fx:{mom:-1,blocs:{union:-1}},r:'The eagle files a grievance with the costume performers’ union.'}]},
 {id:'aiyou',tone:'absurd',t:'An AI chatbot claiming to be you gives better answers',x:'A fake AI version of you is going viral for clearer policy answers than the real you. Some voters prefer it.',c:[
  {l:'Challenge the AI to a debate',fx:{mom:2,gaffe:.3},r:'You win, narrowly. The AI asks for a recount.'},
  {l:'Hire whoever built it',fx:{cash:-1,cred:1,blocs:{young:2}},r:'It’s a 15-year-old in Ohio. He’s now your policy director.'},
  {l:'Demand it be taken down',fx:{blocs:{senior:1,young:-2}},r:'The AI posts a heartfelt goodbye. Thousands of people mourn it.'}]},
 {id:'lottery',tone:'absurd',t:'Your campaign accidentally wins the lottery',x:'An intern bought a lottery ticket with petty cash. It won $2 million. Election lawyers are sweating.',c:[
  {l:'Donate it all to charity',fx:{cred:3,mom:2},r:'Seven food banks and a goat sanctuary rejoice.'},
  {l:'Spend it on ads',fx:{cash:2,cred:-4,exposure:10},r:'The ads are great. The FEC letters are greater.'},
  {l:'Buy the intern a car',fx:{blocs:{young:3},cred:-1},r:'Tanner is thrilled. It was not Tanner’s ticket.'}]},
 // ---- foreign intrigue (fictional nations) ----
 {id:'velmora',tone:'foreign',t:'The Grand Duchy of Velmora wants to fund your campaign',x:'The tiny, oil-rich Duchy of Velmora offers $30 million in exchange for your “full and eternal friendship.” Foreign campaign money is very illegal.',c:[
  {l:'Refuse loudly and report it',fx:{cred:4,mom:2},r:'You’re praised for integrity. Velmora’s Grand Duke sends a hurt emoji.'},
  {l:'Accept a “friendship fruit basket” only',fx:{cred:-1,blocs:{biz:1}},r:'The fruit basket contains a single diamond-encrusted pear. Legal is concerned.'},
  {l:'Take the money through a shell company',fx:{cash:20,exposure:35,setFlag:'velmora'},r:'Your war chest explodes. A Velmoran accountant now has your cell number.'}]},
 {id:'velmora2',tone:'foreign',req:()=>flagAge('velmora',2),t:'Velmora calls in the favor',x:'The Grand Duke wants you to promise his country an aircraft carrier, a seat at the G7, and an emoji.',c:[
  {l:'Promise the emoji only',fx:{cred:-3,exposure:15},r:'The Grand Duke is insulted but accepts the emoji. Your exposure grows.'},
  {l:'Return the money quietly',fx:{cash:-15,cred:-2},r:'The money goes back, minus a 10% “friendship fee.”'},
  {l:'Confess everything',fx:{cred:-10,mom:-4},r:'Brutal headlines, but the story is now yours to tell.'}]},
 {id:'qaravan',tone:'foreign',t:'A crown prince sends you a gold-plated gift',x:'The crown prince of Qaravan sends a solid-gold bobblehead of you. It nods “yes” to everything.',c:[
  {l:'Display it proudly',fx:{blocs:{senior:-1},mom:1,cred:-2},r:'It nods yes to every question on live TV. Commentators are unsettled.'},
  {l:'Donate it to the Smithsonian',fx:{cred:3},r:'It’s displayed next to a moon rock. It nods at the moon rock.'},
  {l:'Melt it down for the campaign',fx:{cash:3,cred:-5},r:'Melting a gift from a foreign prince turns out to be a diplomatic incident.'}]},
 {id:'borduria',tone:'foreign',t:'A rival superpower hacks your playlist',x:'Hackers from the Federated Republic of Borduria leaked your private music playlist. It is 90% sea shanties.',c:[
  {l:'Embrace the shanties',fx:{mom:3,blocs:{young:2,senior:1}},r:'You lead a rally in a sea shanty. Cybersecurity experts weep.'},
  {l:'Call for sanctions on Borduria',fx:{issue:[8,1],blocs:{senior:2}},r:'Borduria responds by leaking {opp}’s playlist. It’s worse.'},
  {l:'Claim the shanties were planted',fx:{cred:-3},r:'Your Spotify Wrapped proves otherwise.'}]},
 // ---- realistic ----
 {id:'bridge',t:'A major bridge collapses',x:'An interstate bridge in Pennsylvania collapses during rush hour. Nobody died, but the region is gridlocked.',c:[
  {l:'Promise a trillion-dollar infrastructure plan',fx:{issue:[0,-1],blocs:{union:4,biz:-1}},r:'Construction unions cheer. Deficit hawks reach for antacids.'},
  {l:'Promise to cut red tape so it’s rebuilt fast',fx:{issue:[0,1],blocs:{biz:3,suburb:1}},r:'A sensible message. The engineers nod.'},
  {l:'Visit the site in a hard hat',fx:{mom:2,blocs:{union:2}},r:'The hard hat is backwards in every photo. Still a good look.'}]},
 {id:'pandemic',t:'A new flu strain spreads',x:'Health officials warn of a fast-spreading flu strain. Every campaign is asked about rallies and masks.',c:[
  {l:'Pause big rallies and push vaccines',fx:{cred:3,blocs:{senior:3,young:-1,rural:-2}},r:'Responsible, if not exciting. Seniors approve.'},
  {l:'Keep campaigning as normal',fx:{mom:1,blocs:{rural:2,senior:-3}},r:'Big crowds, nervous headlines.'},
  {l:'Hold rallies outdoors only',fx:{blocs:{suburb:2}},r:'A reasonable compromise. Several rallies get rained out.'}]},
 {id:'tech',t:'A tech giant is accused of spying on kids',x:'Leaked documents show a social media giant tracked children’s locations. Parents are furious.',c:[
  {l:'Call to break up the company',fx:{blocs:{prog:2,faith:2,suburb:2,biz:-2}},r:'An unusual coalition of parents and activists cheers you on.'},
  {l:'Call for new privacy rules',fx:{blocs:{suburb:3}},r:'Solid, if not thrilling.'},
  {l:'Warn against overregulation',fx:{blocs:{biz:3,suburb:-2}},r:'The tech giant sends a thank-you note. It knows where you live.'}]},
 {id:'farm',t:'A drought devastates Midwest farms',x:'Crop yields are down 40% across the Plains. Farmers want answers.',c:[
  {l:'Promise emergency farm aid',fx:{blocs:{rural:4},cash:0},r:'Farm country listens. Budget watchers do not.'},
  {l:'Tie it to climate change',fx:{issue:[4,-1],blocs:{young:2,rural:-2}},r:'Scientists agree. Many farmers still change the channel.'},
  {l:'Promise new trade deals for crop exports',fx:{blocs:{rural:2,biz:2}},r:'A long-term answer to a short-term crisis.'}]},
 {id:'teachers',t:'Teachers strike in a major city',x:'Thousands of teachers walk out over pay and class sizes. Parents are scrambling for childcare.',c:[
  {l:'Back the teachers',fx:{issue:[7,-1],blocs:{union:3,suburb:-1}},r:'Teachers’ unions are thrilled. Some parents are not.'},
  {l:'Call for school choice',fx:{issue:[7,1],blocs:{faith:2,biz:1,union:-3}},r:'Parents who are tired of strikes listen closely.'},
  {l:'Urge a quick deal for the kids’ sake',fx:{blocs:{suburb:2}},r:'Nobody is offended. Nobody is inspired.'}]},
 // ---- personal-detail events ----
 {id:'tooold',req:()=>bio().age>=72,t:'“Is the candidate too old?”',x:'A viral clip shows you looking confused by a revolving door. Every network asks whether you can handle four years.',c:[
  {l:'Challenge a reporter to push-ups',fx:{mom:3,blocs:{senior:2},gaffe:.2},r:'You do 31. The reporter does 12. The clip gets 40 million views.'},
  {l:'Release your full medical records',fx:{cred:3,blocs:{suburb:1}},r:'You’re apparently healthier than most of the press corps.'},
  {l:'Joke about your age',fx:{mom:1,blocs:{young:2}},r:'“I’ve been around since the revolving door was invented. That’s the problem.”'}]},
 {id:'tooyoung',req:()=>bio().age<=45,t:'“Is the candidate too inexperienced?”',x:'Critics say you’re too young for the job. One pundit calls you “a TikTok with a tie.”',c:[
  {l:'Lean into fresh energy',fx:{mom:2,blocs:{young:3,senior:-1}},r:'“A TikTok with a tie” becomes your favorite T-shirt.'},
  {l:'Roll out a list of experienced advisers',fx:{cred:3,blocs:{senior:2}},r:'Your adviser list averages 68 years old. Balance.'}]},
 {id:'exbook',req:()=>bio().ex==='bitter'||bio().ex==='famous',t:'Your ex announces a tell-all memoir',x:'Your ex’s new book, “Married to the Campaign,” comes out next week. The chapter titles alone are concerning.',c:[
  {l:'Wish them well publicly',fx:{cred:3,blocs:{suburb:2}},r:'Grace under fire. The book still sells, but it doesn’t stick.'},
  {l:'Release your own counter-memoir',fx:{cash:-1,mom:1,cred:-2},r:'“Actually, I Was Married to You” debuts at number two. Ouch.'},
  {l:'Have your lawyers send a cease-and-desist',fx:{cred:-3,mom:-1},r:'The letter is printed as the book’s new foreword.'}]},
 {id:'kidviral',req:()=>bio().kids>=1,t:'Your kid goes viral',x:'Your youngest posted a video rating your speeches out of 10. The highest score was a 4.',c:[
  {l:'Make your kid a campaign surrogate',fx:{mom:2,blocs:{young:3,suburb:1}},r:'Your kid’s approval rating is now higher than yours.'},
  {l:'Ground them (publicly)',fx:{blocs:{faith:2,senior:1,young:-2}},r:'Parents across America nod knowingly.'}]},
 {id:'dropout',req:()=>bio().edu==='dropout',t:'Reporters dig into your college dropout story',x:'A reporter found your final college transcript. Your last grade was in “Bowling 101.” It was a C.',c:[
  {l:'Say you learned more in the real world',fx:{blocs:{young:2,union:2,prog:-1}},r:'Millions of non-graduates feel seen.'},
  {l:'Challenge the reporter to bowling',fx:{mom:2,gaffe:.2},r:'You bowl a 112. The reporter bowls a 180. Still a fun day.'}]},
 {id:'ivy',req:()=>bio().edu==='ivy',t:'Your Ivy League thesis resurfaces',x:'Your senior thesis, “Toward a Post-Structural Theory of Brunch,” is circulating online.',c:[
  {l:'Defend it proudly',fx:{blocs:{prog:2,rural:-2}},r:'Brunch scholars rally to your side. There are more than you’d think.'},
  {l:'Laugh it off: “I was 21”',fx:{mom:1,blocs:{suburb:1}},r:'Most voters remember being 21. Most voters forgive.'}]},
 {id:'yoyo',req:()=>(bio().hobbies||[]).includes('yoyo'),t:'You’re invited to the World Yo-Yo Championship',x:'Organizers want you to perform your famous “Walk the Dog Across America” trick on live TV.',c:[
  {l:'Perform the trick',fx:{mom:3,blocs:{young:3},gaffe:.3},r:'You land it. The crowd loses its mind. Yo-yo sales spike 400%.'},
  {l:'Decline, too risky',fx:{blocs:{young:-1}},r:'The yo-yo community feels betrayed. They are small but loud.'}]},
 {id:'fishing',req:()=>(bio().hobbies||[]).includes('fishing'),t:'A bass fishing tournament invites you',x:'The Southern Bass Classic wants you to compete. {opp} has been fishing for 40 years.',c:[
  {l:'Compete for real',fx:{mom:2,blocs:{rural:3}},r:'You catch a seven-pound bass. Rural America notices.'},
  {l:'Just present the trophy',fx:{blocs:{rural:1}},r:'Safe. The bass are relieved.'}]},
 {id:'cats',req:()=>(bio().hobbies||[]).includes('cats'),t:'One of your eleven cats knocks something off your desk on live TV',x:'During a remote interview, Admiral Whiskers knocks your coffee onto your keyboard. Your mic is stuck on.',c:[
  {l:'Introduce all eleven cats',fx:{mom:3,blocs:{suburb:2,young:2}},r:'The cat segment runs longer than the interview. Ratings soar.'},
  {l:'Keep going like nothing happened',fx:{cred:2},r:'Very professional. Admiral Whiskers is disappointed.'}]},
 {id:'karaoke',req:()=>(bio().hobbies||[]).includes('karaoke'),t:'You’re challenged to a karaoke duel',x:'A late-night host challenges you to sing a power ballad. The key change is brutal.',c:[
  {l:'Go for the key change',fx:{mom:3,blocs:{young:2},gaffe:.25},r:'You hit the note. Somewhere, a glass shatters. A star is born.'},
  {l:'Sing something safe',fx:{mom:1,blocs:{senior:1}},r:'A pleasant, forgettable rendition. Like a campaign ad.'}]},
 {id:'nascar',req:()=>(bio().hobbies||[]).includes('nascar'),t:'You’re asked to wave the green flag at a NASCAR race',x:'Daytona invites you to start the race. 200,000 fans will be watching.',c:[
  {l:'Wave it with gusto',fx:{mom:2,blocs:{rural:3,union:1}},r:'You wave so hard you nearly fall off the stand. They love it.'},
  {l:'Take a hot lap in a race car',fx:{mom:3,blocs:{rural:3},gaffe:.25},r:'You scream the entire time. It’s relatable.'}]},
 // ---- opponent events ----
 {id:'oppgaffe',t:'{opp} has a gaffe of their own',x:'{opp} called a famous swing-state city by the wrong name. Twice. While standing in it.',c:[
  {l:'Pile on with an ad',fx:{cash:-2,mom:1,opp:{mom:-3}},r:'The ad writes itself. You still paid for it.'},
  {l:'Stay classy',fx:{cred:2,opp:{mom:-1}},r:'You let the clip speak for itself. It speaks loudly.'},
  {l:'Make the same mistake an hour later',fx:{mom:-2},r:'Somehow, yes. The networks run both clips side by side.'}]},
 {id:'oppendorse',t:'{opp} lands a celebrity endorsement',x:'A beloved country singer endorses {opp} at a sold-out stadium show.',c:[
  {l:'Get a rival celebrity on the phone',fx:{cash:-1,mom:1},r:'You land a famous chef. It’s not the same, but the food is better.'},
  {l:'Say celebrities don’t decide elections',fx:{cred:1,opp:{mom:2}},r:'True, but this one has 80 million fans.'}]},
 // ---- october surprises ----
 {id:'oct_cyber',october:true,t:'October surprise: a massive hack hits the election',x:'A foreign hacking group dumps thousands of campaign emails from both sides. Yours include a lot of complaints about catering.',c:[
  {l:'Release all your emails first',fx:{cred:4,mom:-1},r:'Radical transparency. Mostly people learn you hate cold sandwiches.'},
  {l:'Focus on what the emails say about {opp}',fx:{mom:2,cred:-2,opp:{mom:-3}},r:'You dominate the news cycle. Some voters wince at using stolen emails.'},
  {l:'Call for a full investigation and stay quiet',fx:{cred:2},r:'The steady approach. Nothing changes, which in October is a win.'}]},
 {id:'oct_jobs',october:true,t:'October surprise: a shocking jobs report',x:'The final jobs report before the election is a disaster: 200,000 jobs lost in a month.',c:[
  {l:'Blame the people in charge',fx:{mom:3,cred:-1},r:'It sticks. Voters are looking for someone to blame.'},
  {l:'Lay out a 100-day jobs plan',fx:{cred:3,blocs:{union:3,suburb:2}},r:'A serious plan at a serious moment. Editorial boards take note.'},
  {l:'Say one report doesn’t tell the whole story',fx:{cred:2,mom:-2},r:'Technically right. Politically, not great.'}]},
 {id:'oct_video',october:true,t:'October surprise: a leaked video of {opp}',x:'A leaked video shows {opp} mocking voters in a swing state at a private fundraiser.',c:[
  {l:'Run it in ads everywhere',fx:{cash:-3,mom:2,opp:{mom:-5,cred:-4}},r:'Brutal and effective. {opp} spends a week apologizing.'},
  {l:'Let the press handle it',fx:{cred:3,opp:{mom:-3,cred:-3}},r:'The video does the damage without your fingerprints on it.'}]},
 {id:'oct_storm',october:true,t:'October surprise: a superstorm hits the East Coast',x:'A massive storm floods the coast a week before the election. Campaigning stops cold.',c:[
  {l:'Volunteer at shelters, no cameras',fx:{cred:4,mom:1},r:'The cameras find you anyway. It looks genuine because it is.'},
  {l:'Keep campaigning in the Midwest',fx:{mom:-2,blocs:{suburb:-2}},r:'It looks callous, even if the math says otherwise.'},
  {l:'Propose a disaster relief package',fx:{blocs:{senior:2,union:2}},r:'A strong, serious answer.'}]}
];
EVENTS.push(...MORE_EVENTS);

/* ---- primary-only extra ---- */
EVENTS.push(
 {id:'straw2',p:'primary',tone:'absurd',t:'A rival’s campaign bus hits yours',x:'In a diner parking lot in New Hampshire, {opp}’s bus backs into yours. The drivers are now fighting.',c:[
  {l:'Break up the fight personally',fx:{mom:2,cred:1},r:'You get between two bus drivers. Heroic, and slightly bruised.'},
  {l:'Post the dashcam footage',fx:{mom:2,opp:{mom:-2},cred:-1},r:'The dashcam goes viral. The drivers become friends.'}]},
 {id:'purity',p:'primary',t:'The party base demands a loyalty pledge',x:'A powerful activist group wants every candidate to sign a pledge on a core issue. {opp} already signed.',c:[
  {l:'Sign it',fx:{blocs:{prog:2,rural:2},cred:-1},r:'The base cheers. Moderates take note for later.'},
  {l:'Refuse: “I don’t sign pledges”',fx:{cred:3,mom:-1},r:'Independent-minded. The base is grumpy.'}]}
);

/* ================= Minor issues ================= */
const MINOR=[
 {k:'weed',n:'Legalize marijuana',q:'Would you legalize marijuana nationwide?',yes:{young:3,prog:2},no:{faith:3,senior:2}},
 {k:'wage',n:'$20 minimum wage',q:'Should the federal minimum wage be $20 an hour?',yes:{union:3,young:2},no:{biz:4}},
 {k:'terms',n:'Congressional term limits',q:'Should members of Congress have term limits?',yes:{suburb:2,rural:2,young:1},no:{senior:1}},
 {k:'ai',n:'Regulate AI',q:'Should the government tightly regulate artificial intelligence?',yes:{union:2,senior:2},no:{biz:2,young:1}},
 {k:'moon',n:'A moon base by 2035',q:'Should America build a moon base by 2035?',yes:{young:2,rural:1},no:{senior:2}},
 {k:'dst',n:'End daylight saving time',q:'Should we end daylight saving time for good?',yes:{rural:2,suburb:1},no:{biz:1}},
 {k:'athletes',n:'Pay college athletes',q:'Should college athletes get paid?',yes:{young:3},no:{faith:1,senior:1}},
 {k:'ufo',n:'Full UFO disclosure',q:'Should the government release everything it knows about UFOs?',yes:{young:2,rural:2},no:{senior:1}},
 {k:'hotdog',n:'A hot dog is a sandwich',q:'Final answer: is a hot dog a sandwich?',yes:{young:1,biz:1},no:{rural:2,senior:1}},
 {k:'social',n:'Ban social media under 16',q:'Should kids under 16 be banned from social media?',yes:{faith:3,senior:2,suburb:1},no:{young:3}},
 {k:'rail',n:'High-speed rail',q:'Should we build a national high-speed rail network?',yes:{prog:3,young:2},no:{rural:2,biz:1}},
 {k:'tips',n:'No tax on tips',q:'Should tips be tax-free?',yes:{union:2,young:2},no:{prog:1}}
];
const MINOR_BY=Object.fromEntries(MINOR.map(m=>[m.k,m]));

/* ================= Personal details ================= */
const CAREERS={
 lawyer:{n:'Trial lawyer',fx:{suburb:1}},doctor:{n:'Small-town doctor',fx:{senior:2}},teacher:{n:'Public school teacher',fx:{union:1,suburb:1}},
 farmer:{n:'Fourth-generation farmer',fx:{rural:2}},founder:{n:'Tech startup founder',fx:{young:1,biz:1,union:-1}},athlete:{n:'Former pro athlete',fx:{rural:1,young:1}},
 pitcher:{n:'Former minor-league pitcher',fx:{rural:1,senior:1}},pastor:{n:'Former youth pastor',fx:{faith:2,prog:-1}},judge:{n:'Reality TV judge',fx:{young:2,senior:-1}},
 dentist:{n:'Dentist',fx:{biz:1}},chef:{n:'Diner owner and short-order cook',fx:{union:1,biz:1}},soldier:{n:'Army veteran',fx:{senior:2,rural:1}}
};
const EDUS={ivy:{n:'Ivy League',fx:{prog:1,rural:-1}},state:{n:'State university',fx:{union:1}},cc:{n:'Community college',fx:{union:1,young:1}},dropout:{n:'College dropout',fx:{young:1}},academy:{n:'Military academy',fx:{senior:2}},online:{n:'Online degree from a university nobody can locate',fx:{young:1}}};
const HOBBIES={fishing:{n:'Bass fishing',fx:{rural:1}},yoyo:{n:'Competitive yo-yo',fx:{young:1}},crossfit:{n:'CrossFit evangelist',fx:{young:1,senior:-1}},birding:{n:'Birdwatching',fx:{senior:1}},cats:{n:'Owns eleven cats',fx:{suburb:1}},
 karaoke:{n:'Karaoke legend',fx:{young:1}},nascar:{n:'NASCAR superfan',fx:{rural:1,union:1}},sourdough:{n:'Sourdough obsessive',fx:{suburb:1}},fantasy:{n:'Fantasy football commissioner',fx:{union:1}},
 messycar:{n:'Famously messy car',fx:{young:1}},plants:{n:'Talks to houseplants',fx:{prog:1}},bobbleheads:{n:'Collects presidential bobbleheads',fx:{senior:1}}};
const MARITAL={single:'Single',married:'Married',divorced:'Divorced',celebspouse:'Married to a celebrity'};
const EXES={none:'No dramatic exes',bitter:'A bitter ex',famous:'A famous ex'};
function randomBio(){const hob=shuffle(Object.keys(HOBBIES)).slice(0,2);const marital=pick(['single','married','married','divorced','celebspouse']);
  return {age:35+Math.floor(rnd()*46),marital,kids:marital==='single'?pick([0,0,1]):pick([0,1,2,3,4]),ex:pick(['none','none','bitter','famous']),career:pick(Object.keys(CAREERS)),edu:pick(Object.keys(EDUS)),hobbies:hob};}
function bioText(b){if(!b)return '';return `${b.age}, ${MARITAL[b.marital].toLowerCase()}${b.kids?', '+b.kids+' kid'+(b.kids>1?'s':''):''}. ${CAREERS[b.career].n}, ${EDUS[b.edu].n}. ${b.hobbies.map(h=>HOBBIES[h].n).join(', ')}.`;}
function bioFx(b){const o={};const add=fx=>{for(const k in fx)o[k]=(o[k]||0)+fx[k];};if(!b)return o;
  add(CAREERS[b.career].fx);add(EDUS[b.edu].fx);b.hobbies.forEach(h=>add(HOBBIES[h].fx));
  if(b.age>=72)add({senior:2,young:-2});else if(b.age<=45)add({young:2,senior:-1});
  if(b.marital==='married'||b.marital==='celebspouse')add({faith:1});if(b.marital==='single')add({young:1,faith:-1});if(b.marital==='celebspouse')add({young:2});
  if(b.kids>=3)add({faith:1,suburb:1});return o;}

/* ================= Endorsers ================= */
const ENDORSERS=[
 {id:'labor',n:'National Federation of Labor',req:{i:0,max:-.4},hint:'wants you at least 20% left on taxes and spending',fx:{union:5},ground:['MI','PA','OH','WI']},
 {id:'sports',n:'American Sportsmen’s League',req:{i:3,min:.8},hint:'wants you at least 40% right on guns',fx:{rural:5}},
 {id:'green',n:'Green Future Coalition',req:{i:4,max:-.8},hint:'wants you at least 40% left on climate',fx:{young:4,prog:3}},
 {id:'mainst',n:'Main Street Business Council',req:{i:0,min:.4},hint:'wants you at least 20% right on taxes',fx:{biz:5},cash:4},
 {id:'pastor',n:'Rev. Jimmy Ray Buckner, megachurch pastor',req:{i:6,min:.6},hint:'wants you at least 30% right on abortion',fx:{faith:5}},
 {id:'popstar',n:'Pop star Kaylee Sparks',req:null,hint:'cares mostly about your support among young voters',fx:{young:5},mom:2},
 {id:'sheriffs',n:'National Sheriffs’ Association',req:{i:5,min:.6},hint:'wants you at least 30% right on crime',fx:{senior:3,rural:2}},
 {id:'teachers',n:'National Teachers Alliance',req:{i:7,max:-.6},hint:'wants you at least 30% left on education',fx:{suburb:2,union:2}},
 {id:'ledger',n:'The National Ledger editorial board',req:{cred:65},hint:'wants credibility of 65 or more and few flip-flops',fx:{suburb:3},cred:3},
 {id:'gov',n:'A popular swing-state governor',req:{cred:58},hint:'wants credibility of 58 or more',fx:{suburb:1},state:true}
];

/* ================= Running mate baggage & platform fights ================= */
const VP_BAGGAGE=['Once lost a staring contest to a sitting senator’s dog, on camera','Owes $14,000 in unpaid parking tickets in three states','Wrote a self-published fantasy novel with a suspiciously familiar villain','Has a timeshare in the Duchy of Velmora','Was briefly married to a professional wrestler named “The Accountant”','Got kicked off a cruise ship for “aggressive shuffleboard”'];
const PLATFORM_FIGHTS={
 D:[{wing:'the progressive wing',i:4,to:-1.6,n:'a Green New Deal–style climate plank'},{wing:'the progressive wing',i:1,to:-1.6,n:'a single-payer healthcare plank'},{wing:'the labor wing',i:0,to:-1.4,n:'a tax-the-rich plank'}],
 R:[{wing:'the conservative wing',i:2,to:1.8,n:'a hard-line border plank'},{wing:'the conservative wing',i:6,to:1.6,n:'a national abortion limits plank'},{wing:'the fiscal hawks',i:0,to:1.6,n:'a flat-tax plank'}],
 C:[{wing:'your founding activists',i:null,n:'a pledge to never compromise on your party’s values'}]
};

/* ================= Extra debate content ================= */
const ISSUE_LINES_ALT=[
 {L:'Billionaires can pay the same rate as their assistants. That’s my whole plan, and it works.',C:'A fair code, a balanced budget, and no surprises for working families.',R:'Your money, your choice. Washington has enough of it already.'},
 {L:'No family should choose between insulin and rent. I’ll cover everyone.',C:'Lower drug prices, protect pre-existing conditions, and leave what works alone.',R:'Put patients and doctors in charge, not bureaucrats.'},
 {L:'We can be a nation of laws and a nation of immigrants. Both.',C:'More agents, faster courts, and a real legal path. That’s the deal.',R:'A country without a border isn’t a country.'},
 {L:'Other countries don’t have this problem. We can fix it.',C:'Responsible owners have nothing to fear from closing loopholes.',R:'Law-abiding gun owners aren’t the problem. Criminals are.'},
 {L:'The clean energy economy is coming. I want it built here.',C:'Cheap power today, clean power tomorrow.',R:'American energy, American jobs, American prices.'},
 {L:'Safety means investing in neighborhoods, not just patrols.',C:'Safe streets and fair policing aren’t opposites.',R:'If you break the law, you face the consequences. Period.'},
 {L:'Politicians have no business in your exam room.',C:'This should be settled closer to home, by the states.',R:'Every life deserves protection.'},
 {L:'Education is a public good. I’ll fund it like one.',C:'Pay teachers more, and make college cost less.',R:'Parents, not bureaucrats, know what’s best for their kids.'},
 {L:'Strength is our alliances. I’ll rebuild them.',C:'Speak softly, and keep the big stick polished.',R:'Weakness invites war. Strength prevents it.'}
];
DQ.push(
 {type:'personal',req:()=>bio().age>=72,t:'You’d be one of the oldest presidents ever. Can you really serve four years?',a:[['joke','I intend to exploit, for political purposes, my opponent’s youth and inexperience.'],['message','I’ve got the experience and the energy. Watch me campaign.'],['attack','I’ll take my stamina over {opp}’s attention span any day.']]},
 {type:'personal',req:()=>bio().age<=45,t:'Critics say you’re too young for this job. Respond.',a:[['joke','I’m old enough to remember when {opp} was considered young. Ancient history.'],['message','Fresh eyes are exactly what Washington needs.'],['policy','Here’s what I’ve actually accomplished, line by line.']]},
 {type:'personal',req:()=>bio().ex==='bitter'||bio().ex==='famous',t:'Your ex says you “couldn’t run a dishwasher, let alone a country.” Response?',a:[['joke','In fairness, that dishwasher was very complicated.'],['message','I wish them well. This election is about your family, not mine.'],['attack','At least my ex has met me. {opp}’s voters can’t say the same.']]},
 {type:'attack',t:'{opp} says you’ve “never had a real job.” Respond.',a:[['attack','I’ve had more real jobs than {opp} has had real ideas.'],['joke','I was a professional campaign candidate. It’s grueling.'],['message','I’ll let my record speak, and it’s been working for people my whole career.']]},
 {type:'gotcha',t:'Lightning round: what’s the price of a gallon of milk?',a:[['policy','About four dollars, and too much for a lot of families.'],['joke','Depends. Is it premium milk?'],['message','Whatever it is, my plan lowers it.']]},
 {type:'personal',t:'What would you do on your first night in the White House?',a:[['joke','Bowl in the basement alley. I’ve been practicing.'],['message','Get to work. There’s a lot to fix.'],['policy','Sign three executive orders. I’ll tell you which ones.']]},
 {type:'attack',t:'{opp} says your plan would “bankrupt the country by Tuesday.” Your response?',a:[['attack','{opp} couldn’t balance a checkbook with a calculator and a tutor.'],['policy','Let’s go through the math together. It adds up.'],['joke','Tuesday? That’s ambitious. I was aiming for Thursday.']]}
);
const REBUTTALS=['That’s the most rehearsed answer I’ve heard since my kid’s school play.','My opponent just said a lot of words and zero numbers.','I’d love to know which focus group wrote that.','That plan has more holes than my golf game.','With respect, that’s not what you said in March.','Nice speech. Too bad it isn’t true.'];
const ZINGERS=['There you go again, reading off your own bumper sticker.','If my opponent’s plans were any thinner, they’d be a pamphlet.','You’ve changed positions so often you should get frequent-flyer miles.','I’ve seen more backbone in a jellyfish at an aquarium gift shop.','That answer was so long I aged a year. And I can’t afford to.'];

/* ================= Election night anchors ================= */
const CLOSE_TIMES=[[0,['GA','IN','KY','SC','VT','VA']],[2,['NC','OH','WV']],[4,['AL','CT','DE','DC','FL','IL','ME','MD','MA','MS','MO','NH','NJ','OK','PA','RI','TN']],[6,['AR']],[8,['AZ','CO','IA','KS','LA','MI','MN','NE','NM','NY','ND','SD','TX','WI','WY']],[12,['MT','NV','UT']],[16,['CA','ID','OR','WA']],[20,['HI']],[24,['AK']]];
const ANCHOR={
 open:['Good evening, and welcome to election night on BSN. The first polls are closing now.','Here we go. Months of campaigning come down to tonight.'],
 close:['Polls have now closed in {states}.','The polls just closed in {states}. Let’s see what we’ve got.'],
 call:['BSN can now project that {name} wins {state}.','We have a call: {state} goes to {name}.','And {name} takes {state}. That one was expected.'],
 closecall:['A big call: {name} wins {state}, a state both campaigns fought hard for.','This is a major projection. {state} goes to {name}.'],
 toss:['{state} is too close to call. This could take a while.','We are not calling {state}. The margin is razor thin.'],
 recount:['{state} is headed for a recount. Both campaigns are sending lawyers.'],
 recountdone:['The recount in {state} is complete. {name} holds on.'],
 late:['It’s getting late, and this race is still not settled.','Some coffee for the anchors, please. We may be here a while.']
};
const SPEECHES={
 win:[{k:'gracious',n:'Gracious and unifying',d:'“To those who didn’t vote for me: I’ll work just as hard for you.”',legacy:60},{k:'triumph',n:'Triumphant',d:'“They said we couldn’t do it. They were wrong. All of them. Specifically them.”',legacy:30},{k:'unhinged',n:'Thank everyone, including Bandit the raccoon',d:'A 47-minute speech that thanks your dentist, a goat, and a raccoon.',legacy:15}],
 lose:[{k:'gracious',n:'Gracious concession',d:'“The people have spoken. I called to congratulate the winner.”',legacy:60},{k:'defiant',n:'Defiant',d:'“This isn’t over. It’s just over for now.”',legacy:10},{k:'comeback',n:'“See you in four years”',d:'You announce your next campaign before the confetti hits the floor.',legacy:30}]
};

/* ================= Random opponents (v4) ================= */
const FIRST=['Margaret','Danny','Ada','Lorraine','Felix','Brock','Charles','Rex','Dusty','Kimberly','Trent','Nadia','Gus','Celeste','Wendell','Priya','Hector','Bianca','Tucker','Marisol','Russell','Ingrid','Desmond','Shelby','Arturo','Faye','Clint','Yolanda','Barrett','Imani','Lionel','Rosalind','Chet','Opal','Raymond','Delphine','Boone','Tamsin','Ezra','Lucinda','Hank','Mei','Otis','Greer','Jolene','Malik','Bettina','Cyrus','Tallulah','Wade'];
const LAST=['Holloway','Whitfield','Kessler','Beck','Ortega','Thurston','Pemberton','Calloway','Hale','Vance','Ashby','Delacroix','Okafor','Lindqvist','Barrows','Castellanos','Whitaker','Kowalski','Montgomery','Fairbanks','Huang','Abernathy','Sorensen','Pruitt','Valentine','McAllister','Grisham','Oyelaran','Tremblay','Hargrove','Banerjee','Lockhart','Dunmore','Esposito','Crenshaw','Yamamoto','Bellweather','Stroud','Galloway','Featherstone'];
const ARCH=[
 {k:'wonk',n:'policy wonk',stats:{cha:2,deb:4,fund:4,comp:4},ext:0,titles:['Sen.','Sec.'],blurbs:['Speeches come with footnotes. Some footnotes have footnotes.','Has a 400-page plan for everything, including lunch.'],
  quotes:['I have a twelve-point plan, and a thirteenth point about the plan.','Let me be boring and correct.','Page 214 of my plan addresses that directly.','As I said in a floor speech nobody watched—']},
 {k:'showman',n:'TV showman',stats:{cha:5,deb:3,fund:4,comp:1},ext:.5,titles:[''],blurbs:['Reality TV veteran who treats every rally like a season finale.','Podcast host whose ad reads are longer than his policy answers.'],
  quotes:['This answer is brought to you by my sponsor.','Folks, the ratings for this debate are huge. Because of me.','I’ve read zero briefing books and I feel fantastic.','Smash that vote button, America.']},
 {k:'firebrand',n:'firebrand',stats:{cha:4,deb:4,fund:3,comp:2},ext:1,titles:['Rep.',''],blurbs:['Livestreams committee hearings to millions. Never met a microphone she didn’t grab.','Viral firebrand with a following that treats him like a rock star.'],
  quotes:['I’m going live in five. Say something worth clipping.','The system isn’t broken. It’s working exactly as designed.','Chat, are we seeing this?','I didn’t come here to make friends. I came here to make clips.']},
 {k:'insider',n:'old-money insider',stats:{cha:2,deb:4,fund:5,comp:2},ext:-.3,titles:['Sen.','Gov.'],blurbs:['Donors adore them. Voters are still deciding.','Third-generation politician whose family name is on a bridge, a hospital, and a yacht.'],
  quotes:['My grandfather built this country. Specifically, parts of the suburbs.','One must consult the donors— I mean, the voters.','Fiscal discipline is a family value. We have a foundation for it.']},
 {k:'folksy',n:'folksy everyperson',stats:{cha:4,deb:2,fund:3,comp:4},ext:0,titles:['Gov.','Sen.'],blurbs:['Still drives a 2003 pickup and mentions it in every speech.','Brings a horse named Liberty to every press conference.'],
  quotes:['Out where I’m from, we don’t have problems. We have chores.','Let’s cut the fancy talk and get to work.','My truck has 300,000 miles on it, by the way.','Liberty the horse and I agree on most things.']},
 {k:'prosecutor',n:'prosecutor',stats:{cha:3,deb:5,fund:3,comp:2},ext:.3,titles:['Gov.','AG'],blurbs:['Former prosecutor who hasn’t blinked since 2019.','Cross-examines waiters about the specials.'],
  quotes:['Objection. Sustained. By me.','I’ve cross-examined tougher witnesses than this electorate.','Let the record show I am winning.']},
 {k:'doctor',n:'TV doctor',stats:{cha:4,deb:3,fund:4,comp:2},ext:0,titles:['Dr.'],blurbs:['TV doctor who diagnoses the economy on live television.','Wrote a bestselling diet book and a less successful foreign policy book.'],
  quotes:['Say “ahh,” America.','The economy has a fever, and the prescription is me.','I’m not that kind of doctor. But I am a doctor.']},
 {k:'veteran',n:'war hero',stats:{cha:3,deb:2,fund:3,comp:5},ext:.2,titles:['Gen.','Sen.'],blurbs:['Decorated veteran with a handshake that has ended careers.','Speaks only in short, declarative sentences. Like this one.'],
  quotes:['I’ve been under fire before. This is not fire.','Duty. Honor. Polling.','I don’t do spin. I do push-ups.']},
 {k:'outsider',n:'business outsider',stats:{cha:4,deb:2,fund:5,comp:2},ext:.4,titles:[''],blurbs:['Self-made tycoon who calls the federal government “a startup with bad management.”','Energy-drink billionaire who has never finished a thought on schedule.'],
  quotes:['I’d run this country like a business. A very successful one.','Washington needs a CEO, and I have the vest for it.','Let’s circle back on that after the IPO.']}
];
const OPP_SECRETS=['Has never actually visited the town their whole campaign is built around','Their famous family recipe comes from a can','Their “humble childhood home” was the guest house','They’ve been banned from a Cheesecake Factory for life','Their memoir’s dramatic rescue story involved a very calm cat','They wrote fan fiction about themselves under a pen name','Their campaign horse is a rental','Their medical license was renewed online during a commercial break','Their “self-made fortune” started with a $4 million loan from grandma','They lost their first case to a man in a Hawaiian shirt','Their signature pickup truck is a prop; they drive a luxury SUV','They cheated at a charity golf tournament, on camera, twice','They’ve never once used the public transit they keep promising to fund','Their mascot dog belongs to a staffer'];
function genCandidate(party,i){
  const ar=pick(ARCH);const first=pick(FIRST),last=pick(LAST);
  const base=DEF[party];const dir=party==='D'?-1:1;
  const pos=base.map(v=>clamp(Math.round((v+dir*ar.ext+(rnd()*1.2-.6))*4)/4,-2,2));
  const stats={...ar.stats};const ks=['cha','deb','fund','comp'];for(let k=0;k<2;k++){const a=pick(ks),b=pick(ks);if(stats[a]<5&&stats[b]>1&&a!==b){stats[a]++;stats[b]--;}}
  const home=pick(ST_LIST.filter(s=>s.a!=='DC'&&(party==='D'?s.lean>-12:s.lean<12))).a;
  return {id:'o'+party+i,party,name:first+' '+last,title:pick(ar.titles),home,pos,stats,pq:rnd()*5,blurb:pick(ar.blurbs),quotes:ar.quotes.slice(),arch:ar.n,
    bio:randomBio(),secret:pick(OPP_SECRETS),perk:pick(Object.keys(PERKS)),flaw:pick(Object.keys(FLAWS))};
}
function generateRoster(){const used=new Set();const out=[];
  ['D','R'].forEach(p=>{for(let i=0;i<5;i++){let c,g=0;do{c=genCandidate(p,i);}while((used.has(c.name)||used.has(c.name.split(' ')[1]))&&g++<20);used.add(c.name);used.add(c.name.split(' ')[1]);out.push(c);}});return out;}

/* ================= Regional, position-triggered, and opponent events ================= */
const posOfP=i=>P().pos[i];
EVENTS.push(
 {id:'fl_hurricane',state:'FL',t:'A hurricane makes landfall in Florida',x:'A major hurricane hits the Florida coast. Floridians are watching how every candidate responds.',c:[
  {l:'Fly in and work a shelter',fx:{mom:1,states:{FL:4}},r:'Floridians notice. You smell like a gymnasium for three days.'},
  {l:'Push for federal disaster aid',fx:{states:{FL:3},blocs:{senior:1}},r:'Florida officials from both parties thank you.'},
  {l:'Keep your schedule elsewhere',fx:{states:{FL:-4}},r:'A Florida paper runs your photo with the headline “WHERE WERE YOU?”'}]},
 {id:'tx_grid',state:'TX',t:'The Texas power grid fails in a freeze',x:'Millions of Texans lose power in a deep freeze. Pipes burst across the state.',c:[
  {l:'Call for grid upgrades and winterization',fx:{states:{TX:3},blocs:{suburb:1}},r:'Sensible and popular in Texas.'},
  {l:'Blame wind turbines',fx:{states:{TX:2},blocs:{rural:1,young:-2},cred:-1},r:'Engineers point out the gas plants froze too. Some voters don’t care.'},
  {l:'Blame the state’s go-it-alone grid',fx:{states:{TX:-2},blocs:{prog:2}},r:'Texans don’t love being told their grid is the problem, even when it is.'}]},
 {id:'mi_plant',state:'MI',t:'A Michigan auto plant announces layoffs',x:'Three thousand jobs are on the line in suburban Detroit.',c:[
  {l:'Rally with the workers outside the plant',fx:{states:{MI:4},blocs:{union:2}},r:'You give a fiery speech in the parking lot. Michigan notices.'},
  {l:'Promise EV battery investment in Michigan',fx:{states:{MI:3},blocs:{young:1}},r:'A forward-looking pitch. Some workers wonder about the timeline.'},
  {l:'Say the market is adjusting',fx:{states:{MI:-4},blocs:{biz:1}},r:'Michigan does not appreciate the adjustment.'}]},
 {id:'az_water',state:'AZ',t:'Arizona faces a water crisis',x:'Colorado River levels hit record lows. Phoenix suburbs face water cuts.',c:[
  {l:'Promise a western water summit',fx:{states:{AZ:3,NV:2}},r:'Westerners appreciate being taken seriously.'},
  {l:'Push desalination megaprojects',fx:{states:{AZ:2},blocs:{biz:1}},r:'Big, bold, and expensive.'},
  {l:'Tell Arizonans to “conserve more”',fx:{states:{AZ:-3,NV:-1}},r:'A Phoenix talk radio host calls you “the guy who wants us to shower less.”'}]},
 {id:'pa_fracking',state:'PA',t:'Fracking becomes a fight in Pennsylvania',x:'A Pennsylvania town is split between gas jobs and polluted wells.',c:[
  {l:'Defend gas jobs',fx:{states:{PA:3},issue:[4,1],blocs:{young:-1}},r:'Western Pennsylvania cheers. Philly suburbs are lukewarm.'},
  {l:'Call for a phase-out with job guarantees',fx:{states:{PA:-1},issue:[4,-1],blocs:{young:2}},r:'Climate groups love it. Gas towns are worried.'},
  {l:'Call for stricter safety rules, not a ban',fx:{states:{PA:2},blocs:{suburb:1}},r:'A middle path that plays well across the state.'}]},
 {id:'ga_film',state:'GA',t:'Georgia’s film industry goes on strike',x:'Production crews walk off Atlanta sets. Half of Hollywood is suddenly in Georgia’s news.',c:[
  {l:'Back the crews',fx:{states:{GA:3},blocs:{union:2}},r:'Crew members and a few famous actors cheer you on.'},
  {l:'Call for a fast deal to protect Georgia jobs',fx:{states:{GA:2},blocs:{biz:1}},r:'Practical. Atlanta notices.'}]},
 {id:'wi_dairy',state:'WI',t:'Wisconsin dairy farms are going under',x:'Small dairy farms are closing at a record pace. Wisconsin wants answers.',c:[
  {l:'Promise dairy price supports',fx:{states:{WI:4},blocs:{rural:2}},r:'Cheese country is listening.'},
  {l:'Hold a rally at a dairy farm',fx:{states:{WI:2},mom:1},r:'A cow tries to eat your notes. It’s great TV.'},
  {l:'Say small farms need to modernize',fx:{states:{WI:-4}},r:'Wisconsin hears “your farm is obsolete.”'}]},
 {id:'nv_casino',state:'NV',t:'Las Vegas casino workers strike',x:'Fifty thousand hospitality workers walk off the Strip.',c:[
  {l:'Join the picket line on the Strip',fx:{states:{NV:4},blocs:{union:2}},r:'You march past fountains and Elvis impersonators. Nevada notices.'},
  {l:'Urge both sides back to the table',fx:{states:{NV:1}},r:'Safe, forgettable.'}]},
 {id:'nc_tech',state:'NC',t:'A tech giant picks North Carolina for a new campus',x:'A huge tech campus is coming to the Research Triangle, with 10,000 jobs.',c:[
  {l:'Take credit',fx:{states:{NC:2},cred:-2},r:'You had nothing to do with it. Reporters point that out.'},
  {l:'Tour the site and talk jobs',fx:{states:{NC:3}},r:'A solid photo op in a state that matters.'}]},
 {id:'pos_guns',req:()=>posOfP(3)<=-1.2,t:'Gun shop owners protest your rally',x:'Because of your gun stance, a convoy of trucks circles your rally in a swing state, honking for an hour.',c:[
  {l:'Invite their leader on stage',fx:{cred:2,blocs:{rural:2}},r:'A tense, respectful conversation goes viral for the right reasons.'},
  {l:'Out-shout them',fx:{blocs:{prog:2,rural:-2},mom:1},r:'Your base loves it. The honking continues.'},
  {l:'Moderate your stance a little',fx:{issue:[3,1]},r:'The convoy leaves. Some of your supporters leave too.'}]},
 {id:'pos_climate',req:()=>posOfP(4)>=1.2,t:'Scientists sign an open letter against you',x:'Over 2,000 scientists sign a letter calling your energy plan “a disaster.”',c:[
  {l:'Stand firm: “Energy independence first”',fx:{blocs:{rural:2,union:1,young:-2}},r:'Oil country cheers. Campus towns boo.'},
  {l:'Add clean energy to your plan',fx:{issue:[4,-1]},r:'The scientists call it “a start.” Your base calls it something else.'}]},
 {id:'pos_tax',req:()=>posOfP(0)<=-1.3,t:'A billionaire threatens to move to Velmora',x:'Upset by your tax plan, a billionaire says he’ll move to the Grand Duchy of Velmora if you win.',c:[
  {l:'Offer to help him pack',fx:{mom:3,blocs:{prog:2,young:2,biz:-2}},r:'The clip is everywhere. Velmora says it doesn’t want him either.'},
  {l:'Reassure job creators',fx:{blocs:{biz:2,prog:-2}},r:'Measured. The billionaire stays, grumbling.'}]},
 {id:'pos_immig',req:()=>posOfP(2)>=1.4,t:'Farmers warn of a labor shortage',x:'Farm groups say your border plan would leave crops rotting in the fields.',c:[
  {l:'Promise a guest worker program',fx:{blocs:{rural:2,biz:2}},r:'A practical fix. Some hard-liners grumble.'},
  {l:'Hold the line',fx:{blocs:{rural:-2},cred:1},r:'Consistent, but farmers are nervous.'}]},
 {id:'pos_mush',req:()=>P().pos.filter(v=>Math.abs(v)<.4).length>=6,t:'Pundits call you “mush”',x:'A famous columnist writes that your platform is “a warm bowl of nothing.”',c:[
  {l:'Embrace it: “Mush is comforting”',fx:{mom:2,blocs:{suburb:2}},r:'Mush merchandise sells out. Moderates feel seen.'},
  {l:'Announce a bold new idea',fx:{mom:1,cred:-1},r:'You propose a moon base for retirees. Bold, certainly.'}]},
 {id:'pos_abort',req:()=>Math.abs(posOfP(6))>=1.6,t:'Protesters camp outside your hotel',x:'Because of your abortion stance, protesters from the other side have camped outside your hotel for three days.',c:[
  {l:'Meet with them respectfully',fx:{cred:2,blocs:{suburb:1}},r:'No minds changed, but the meeting earns quiet respect.'},
  {l:'Use them in a fundraising email',fx:{cash:3,cred:-1},r:'The email raises a lot. It feels a little gross.'}]},
 {id:'opp_slogan',p:'gen',t:'{opp} steals your slogan',x:'{opp}’s new campaign signs use your slogan, word for word. In a different font.',c:[
  {l:'Sue for slogan theft',fx:{mom:1,cash:-1},r:'The judge laughs. So does America. It works anyway.'},
  {l:'Get a better slogan',fx:{mom:2},r:'Your new slogan tests 12 points higher. Thanks, {opp}.'},
  {l:'Say imitation is flattery',fx:{cred:2,opp:{mom:-1}},r:'Gracious. {opp} looks unoriginal.'}]},
 {id:'opp_home',p:'gen',t:'{opp} campaigns in your home state',x:'{opp} just held a huge rally in your home state, calling you “a stranger to your own people.”',c:[
  {l:'Rally back the next day',fx:{homeBoost:4},r:'Your home crowd shows up big. It’s personal now.'},
  {l:'Ignore it',fx:{homeBoost:-2},r:'Some locals feel taken for granted.'}]},
 {id:'opp_hobby',p:'gen',t:'{opp} mocks your hobby',x:'{opp} ran an ad mocking your love of {hobby}. The ad features a sad violin.',c:[
  {l:'Lean in with a hobby-themed ad',fx:{mom:2,blocs:{young:1}},r:'Your ad is funnier. Hobby enthusiasts unite behind you.'},
  {l:'Call it petty',fx:{cred:1,opp:{mom:-1}},r:'Most voters agree it was petty.'}]},
 {id:'opp_challenge',p:'gen',t:'{opp} challenges you to an extra debate',x:'{opp} wants a fourth debate on a cable network known for chaotic moderators.',c:[
  {l:'Accept',fx:{mom:2,gaffe:.3},r:'The extra debate is a circus, but you hold your own.'},
  {l:'Decline: “Three is plenty”',fx:{opp:{mom:1},blocs:{senior:1}},r:'{opp} calls you scared for a week.'}]},
 {id:'opp_leak',p:'gen',t:'{opp}’s campaign leaks your travel schedule',x:'Protesters and a mariachi band now meet you at every stop.',c:[
  {l:'Hire the mariachi band',fx:{mom:3},r:'Your rallies have never been more fun.'},
  {l:'Change your schedule constantly',fx:{cred:-1,mom:-1},r:'Your staff is exhausted. The band finds you anyway.'}]},
 {id:'opp_meltdown',p:'gen',t:'{opp} has an on-air meltdown',x:'{opp} stormed off a morning show after a question about polls.',c:[
  {l:'Say nothing and let it play',fx:{opp:{mom:-3},cred:1},r:'The clip plays itself, on loop, everywhere.'},
  {l:'Mock it in an ad',fx:{cash:-2,opp:{mom:-4},cred:-1},r:'Effective, if a bit mean.'}]}
);
/* national mood: these hurt the party in power */
[['recession',-2],['gas',-1],['crime',-1],['border',-1],['oct_jobs',-3],['pandemic',-1],['bridge',-1]].forEach(([id,m])=>{const e=EVENTS.find(x=>x.id===id);if(e)e.mood=m;});

/* ================= Endgame titles ================= */
function campaignTitle(r){
  if(r.lostNomination)return 'The Also-Ran';
  if(r.won){if(r.ev>=450)return 'The Landslide Legend';if(G.trailedFinal)return 'The Comeback Kid';if(P().party==='C')return 'The Insurgent';if(G.secretState==='exposed')return 'The Teflon Titan';if(G.flips>=5)return 'The Weathervane-in-Chief';if(r.house)return 'The Constitutional Crisis';if(r.ev<=290)return 'The Squeaker';return 'The President-Elect';}
  if(P().party==='C'&&r.ev>0)return 'The Kingmaker';if(r.ev>=240)return 'The Almost-President';if(G.speech&&G.speech.k==='gracious')return 'The Gracious Loser';if(r.ev<100)return 'The Footnote';return 'The Runner-Up';
}

/* ================= Music (original, generated in the browser) ================= */
const Music=(()=>{
  const saved=store.get('politicaster.music');
  const M={on:saved?saved.on!==false:true,vol:saved&&saved.vol!==undefined?saved.vol:.35,mode:'menu',ctx:null,master:null,noise:null,timer:null,step:0,bar:0,next:0,started:false};
  const MODES={
    menu:{bpm:92,root:60,prog:[[0,4,7],[9,12,16],[5,9,12],[7,11,14]],pad:'triangle',padG:.05,bass:[0,8],arp:2,arpG:.025,kick:[],snare:[],hat:[],mel:null},
    plan:{bpm:112,root:60,prog:[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],pad:'triangle',padG:.035,bass:[0,6,8,14],arp:2,arpG:.03,kick:[0,8],snare:[4,12],hat:[2,6,10,14],
      mel:[[12,null,16,null,19,null,16,14,12,null,null,null,14,16,null,null],[19,null,null,17,16,null,14,null,16,null,12,null,null,null,null,null],[16,null,16,17,19,null,21,null,19,null,16,null,14,null,null,null],[12,null,14,null,16,null,14,null,12,null,null,null,7,null,null,null]]},
    tension:{bpm:96,root:57,prog:[[0,3,7],[8,12,15],[5,8,12],[7,11,14]],pad:'sawtooth',padG:.02,bass:[0,2,4,6,8,10,12,14],arp:0,kick:[0,8],snare:[],hat:[0,4,8,12],mel:null,dark:true},
    debate:{bpm:84,root:50,prog:[[0,3,7],[10,14,17],[8,12,15],[7,11,14]],pad:'sawtooth',padG:.045,bass:[0,12],arp:4,arpG:.02,kick:[0],snare:[12],hat:[],mel:null,dark:true},
    night:{bpm:76,root:55,prog:[[0,3,7],[8,12,15],[3,7,10],[10,14,17]],pad:'triangle',padG:.05,bass:[0,10],arp:0,kick:[0,6],snare:[],hat:[0,2,4,6,8,10,12,14],mel:null,dark:true},
    victory:{bpm:120,root:60,prog:[[0,4,7],[5,9,12],[7,11,14],[0,4,7]],pad:'sawtooth',padG:.04,bass:[0,4,8,12],arp:2,arpG:.03,kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14],
      mel:[[7,null,7,7,12,null,null,null,16,null,14,12,14,null,null,null],[17,null,16,14,12,null,14,null,16,null,null,null,12,null,null,null],[19,null,19,19,21,null,19,null,17,null,16,null,14,null,null,null],[12,null,16,null,19,null,24,null,null,null,null,null,null,null,null,null]]},
    defeat:{bpm:66,root:57,prog:[[0,3,7],[5,8,12],[3,7,10],[7,10,14]],pad:'triangle',padG:.05,bass:[0],arp:4,arpG:.018,kick:[],snare:[],hat:[],mel:null,dark:true}
  };
  const f=m=>440*Math.pow(2,(m-69)/12);
  function vol(){return M.on?M.vol:0;}
  function init(){
    if(M.ctx)return true;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
    try{M.ctx=new AC();}catch(e){return false;}
    M.master=M.ctx.createGain();M.master.gain.value=vol();M.master.connect(M.ctx.destination);
    const len=M.ctx.sampleRate*.5;const buf=M.ctx.createBuffer(1,len,M.ctx.sampleRate);const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;M.noise=buf;
    return true;
  }
  function tone(freq,t,dur,type,g,cut){
    const o=M.ctx.createOscillator(),a=M.ctx.createGain();o.type=type;o.frequency.value=freq;
    let node=o;if(cut){const fl=M.ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=cut;o.connect(fl);node=fl;}
    node.connect(a);a.connect(M.master);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(g,t+Math.min(.02,dur/4));a.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.start(t);o.stop(t+dur+.05);
  }
  function hit(t,kind){
    if(kind==='kick'){const o=M.ctx.createOscillator(),a=M.ctx.createGain();o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(40,t+.15);a.gain.setValueAtTime(.25,t);a.gain.exponentialRampToValueAtTime(.0001,t+.25);o.connect(a);a.connect(M.master);o.start(t);o.stop(t+.3);return;}
    const s=M.ctx.createBufferSource(),fl=M.ctx.createBiquadFilter(),a=M.ctx.createGain();s.buffer=M.noise;
    fl.type=kind==='hat'?'highpass':'bandpass';fl.frequency.value=kind==='hat'?7000:1800;
    const g=kind==='hat'?.035:.09,dur=kind==='hat'?.04:.14;a.gain.setValueAtTime(g,t);a.gain.exponentialRampToValueAtTime(.0001,t+dur);
    s.connect(fl);fl.connect(a);a.connect(M.master);s.start(t);s.stop(t+dur+.02);
  }
  function schedule(){
    if(!M.ctx)return;
    while(M.next<M.ctx.currentTime+.15){
      const md=MODES[M.mode];const sp=60/md.bpm/4;const t=M.next;const s=M.step,b=M.bar%4;const ch=md.prog[b];const r=md.root;
      if(vol()>0){
        if(s===0)ch.forEach(n=>tone(f(r+n),t,sp*16,md.pad,md.padG,md.dark?900:1800));
        if(md.bass.includes(s))tone(f(r+ch[0]-24),t,sp*(md.bass.length>4?1.6:3.5),'triangle',.12,600);
        if(md.arp&&s%md.arp===0)tone(f(r+ch[(s/md.arp)%3]+12),t,sp*md.arp*.9,md.dark?'triangle':'square',md.arpG,md.dark?1200:2600);
        if(md.mel){const n=md.mel[b][s];if(n!==null&&n!==undefined)tone(f(r+n),t,sp*2.2,'square',.035,3000);}
        if(md.kick.includes(s))hit(t,'kick');if(md.snare.includes(s))hit(t,'snare');if(md.hat.includes(s))hit(t,'hat');
      }
      M.next+=sp;M.step=(M.step+1)%16;if(M.step===0)M.bar++;
    }
  }
  M.unlock=function(){
    if(!M.on)return;if(!init())return;
    if(M.ctx.state==='suspended')M.ctx.resume();
    if(!M.started){M.started=true;M.next=M.ctx.currentTime+.1;M.timer=setInterval(schedule,40);}
  };
  M.play=function(mode){if(!MODES[mode]||M.mode===mode)return;M.mode=mode;M.step=0;M.bar=0;if(M.ctx)M.next=Math.max(M.next,M.ctx.currentTime+.05);};
  M.persist=function(){store.set('politicaster.music',{on:M.on,vol:M.vol});};
  M.toggle=function(){M.on=!M.on;M.persist();if(M.on)M.unlock();if(M.master)M.master.gain.setTargetAtTime(vol(),M.ctx.currentTime,.05);};
  M.setVol=function(v){M.vol=v;M.persist();if(M.master)M.master.gain.setTargetAtTime(vol(),M.ctx.currentTime,.05);};
  return M;
})();
/* ================= Sound effects ================= */
const SFX=(()=>{
  const sv=store.get('politicaster.sfx');const S={on:sv?sv.on!==false:true,vol:sv&&sv.vol!==undefined?sv.vol:.5};
  function ctx(){Music.unlock();if(!Music.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;try{Music.ctx=new AC();}catch(e){return null;}}return Music.ctx;}
  function noise(c,t,dur,type,freq,g,flutter){const len=Math.floor(c.sampleRate*dur);const b=c.createBuffer(1,len,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<len;i++){const env=flutter?(.6+.4*Math.sin(i/c.sampleRate*2*Math.PI*flutter*(1+Math.random()*.3))):1;d[i]=(Math.random()*2-1)*env;}
    const s=c.createBufferSource(),f=c.createBiquadFilter(),a=c.createGain();s.buffer=b;f.type=type;f.frequency.value=freq;s.connect(f);f.connect(a);a.connect(c.destination);
    a.gain.setValueAtTime(0,t);a.gain.linearRampToValueAtTime(g*S.vol,t+Math.min(.3,dur/4));a.gain.linearRampToValueAtTime(g*S.vol*.8,t+dur*.7);a.gain.exponentialRampToValueAtTime(.0001,t+dur);s.start(t);s.stop(t+dur+.05);}
  function beep(c,t,freq,dur,type,g){const o=c.createOscillator(),a=c.createGain();o.type=type;o.frequency.value=freq;o.connect(a);a.connect(c.destination);a.gain.setValueAtTime(g*S.vol,t);a.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.05);}
  S.play=function(n){if(!S.on||S.vol<=0)return;const c=ctx();if(!c)return;if(c.state==='suspended')c.resume();const t=c.currentTime+.02;
    if(n==='applause')noise(c,t,1.8,'bandpass',2200,.35,14);
    if(n==='bigapplause')noise(c,t,3.5,'bandpass',2000,.45,16);
    if(n==='gasp'){const len=.6;noise(c,t,len,'bandpass',900,.25,0);}
    if(n==='gavel'){beep(c,t,180,.12,'square',.25);beep(c,t+.18,170,.12,'square',.2);}
    if(n==='ding'){beep(c,t,1046,.5,'sine',.25);beep(c,t+.12,1318,.6,'sine',.2);}
    if(n==='cash'){beep(c,t,1318,.12,'square',.12);beep(c,t+.09,1760,.25,'square',.12);}
    if(n==='boo'){const o=c.createOscillator(),a=c.createGain();o.type='sawtooth';o.frequency.setValueAtTime(220,t);o.frequency.linearRampToValueAtTime(150,t+.9);const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=600;o.connect(f);f.connect(a);a.connect(c.destination);a.gain.setValueAtTime(.12*S.vol,t);a.gain.exponentialRampToValueAtTime(.0001,t+1);o.start(t);o.stop(t+1.05);}
  };
  S.persist=function(){store.set('politicaster.sfx',{on:S.on,vol:S.vol});};
  S.toggle=function(){S.on=!S.on;S.persist();};
  S.setVol=function(v){S.vol=v;S.persist();};
  return S;
})();
/* ================= Achievements ================= */
const ACH=[
 {id:'landslide',n:'Landslide',d:'Win 400 or more electoral votes.'},
 {id:'squeaker',n:'Photo finish',d:'Win with 275 electoral votes or fewer.'},
 {id:'comeback',n:'Comeback kid',d:'Win after trailing in the final national poll.'},
 {id:'upstart',n:'Upstart',d:'Win the presidency with a party you created.'},
 {id:'beachhead',n:'Beachhead',d:'Carry at least one state with a party you created.'},
 {id:'kingmaker',n:'Kingmaker',d:'With your own party, win more votes in a state than the margin between the top two.'},
 {id:'teflon',n:'Survivor',d:'Win after your secret comes out.'},
 {id:'flipper',n:'Flip-flop champion',d:'Flip-flop five times and still win.'},
 {id:'steady',n:'Steady hand',d:'Win without a single flip-flop.'},
 {id:'debater',n:'Debate champ',d:'Win every general election debate.'},
 {id:'confession',n:'Clean conscience',d:'Come clean about your secret before it leaks.'},
 {id:'upset',n:'Primary upset',d:'Win the nomination after losing the first round.'},
 {id:'house',n:'Constitutional crisis',d:'Send the election to the House.'},
 {id:'dirt',n:'Opposition researcher',d:'Release dirt on an opponent.'},
 {id:'bandit',n:'Bandit’s boss',d:'Make the raccoon your mascot.'},
 {id:'gracious',n:'Class act',d:'Give a gracious concession speech.'},
 {id:'recount',n:'Hanging chads',d:'Have a state go to a recount on election night.'}
];

/* ================= Tooltip & glossary text ================= */
const TIPS={
 cash:'Cash pays for ads, ground game, and burying secrets. Rallies are free. Raise money with fundraisers and donor dinners. The second number is what you’ll have after this week’s plan.',
 actions:'You get 4 actions each week. Add them to your plan, remove or swap them freely, and nothing happens until you end the week.',
 cred:'Credibility (0–100) is how much voters trust you. Above 60 helps you in every state; below 60 hurts. Flip-flops and scandals lower it; consistency raises it.',
 mom:'Momentum is buzz. It adds to your support in every state but fades about 15% each week. Debates, interviews, primary wins, and good event choices build it.',
 exposure:'How close the press is to finding your secret. It rises every week, faster when you’re leading. At 100% the story breaks.',
 ev:'Electoral votes. Win a state and you get all of its votes. You need 270 of 538 to win.',
staff:'Staff size sets how many actions you get each week and what it costs. Lean: 3 actions, $0.5M/week. Standard: 4 actions, $1.5M/week. Juggernaut: 5 actions, $3M/week.',
 delegates:'Primary contests award delegates in proportion to the vote (15% minimum to get any). Most delegates after Super Tuesday wins the nomination.'
};
const GLOSSARY=[
 ['Polls','Every state is polled weekly. Polls have a margin of error, so small leads can be illusions. Map colors show who leads; darker means a bigger lead.'],
 ['Electoral votes',TIPS.ev],['Delegates',TIPS.delegates],
 ['Cash',TIPS.cash],['Actions',TIPS.actions],['Credibility',TIPS.cred],['Momentum',TIPS.mom],['Secret exposure',TIPS.exposure],
 ['Charisma',STAT_TIPS.cha],['Debate',STAT_TIPS.deb],['Fundraising',STAT_TIPS.fund],['Composure',STAT_TIPS.comp],
 ['Voter groups','Eight groups with different priorities. Your platform and event choices move them. Each state has a different mix, so the same position helps you in one state and hurts in another.'],
 ['Flip-flop','Choosing something that contradicts your platform moves your position and costs credibility. Choosing in line with it earns a little credibility.'],
 ['Hold a rally','Free. Adds a solid boost in one state. Fades about 30% each week, so return to states that matter.'],
 ['Buy TV ads','Costs money (bigger states cost more). Adds a bigger boost in one state. Fades about 25% each week.'],
 ['Build ground game','Cheap and small, but it never fades. Best early in states you’ll fight over all campaign.'],
 ['Hold a fundraiser','Raises cash based on your Fundraising stat.'],
 ['Big-donor dinner','Raises a lot of cash, but progressives and young voters notice, and it nicks your credibility.'],
 ['National interview','Adds momentum everywhere. A small chance of a gaffe, bigger if you’re a gaffe machine.'],
 ['Debate prep','Each session improves your odds on every debate answer. At 2 or more sessions you see exact odds.'],
 ['Bury your secret','Lowers exposure. A staffer might leak and make it worse.'],
 ['Come clean','Removes your secret for good. A small hit now instead of a big one later.'],
 ['Petition drive','Own-party only: gets you on the ballot in a state before the deadline. You can’t win votes where you’re not on the ballot.'],
 ['Debate stage (own party)','You need 15% in national polls to be invited to a general election debate.'],
 ['Staff size',"Lean: 3 actions, $0.5M/week. Standard: 4 actions, $1.5M/week. Juggernaut: 5 actions, $3M/week. Change it in your plan panel."],
 ['Policy speech','Once per week, shift one issue by up to 25%. Small shifts are a cheap clarification; big ones cost credibility and can count as a flip-flop.'],
 ['Hidden thresholds','Every voter group has a comfort zone on each issue, and they shift a little every game. Focus groups and state voices hint when you are close. An internal poll reveals one exactly.'],
 ['Internal poll','Costs money. Reveals the comfort zone of the voter group your platform is costing you the most with (or a core primary threshold during primaries).'],
 ['Opposition research','Dig for dirt on an opponent. Clean digging is slower and costs more. Dirty digging is fast and cheap but can leak and backfire. At 100% you can release it.'],
 ['Attack ad','Lowers your strongest opponent’s support in one state. Costs a little credibility.'],
 ['Endorsements','Court a group or figure. If you meet what they want, odds are good. Endorsements last all campaign. Opponents court them too.'],
 ['Minor issues','Smaller issues a few voter groups care about. You pick 3–5 at the start, but reporters can ask about any of them.'],
 ['Donor strings','Big donors sometimes attach a demand. Comply and your position shifts; refuse and they cut you off and may leak.']
];

/* ================= State ================= */
let G=null;
const UI={mq:[],screen:'title',modal:null,pending:null,hover:null,S:null,night:null,guide:null,flash:'',tutOffer:false,tut:null};
let PREVIEW=null;
const TOL=.35;
function idealOf(bk,i){return IDEAL[bk][i]+(G&&G.ish?G.ish[bk][i]:0);}
function appeal(pos,bk){const w=WEIGHT[bk];let s=0,t=0;for(let i=0;i<9;i++){const d=Math.max(0,Math.abs(pos[i]-idealOf(bk,i))-TOL);s+=w[i]*(1-d/1.8);t+=w[i];}return s/t;}
function defAp(p,bk){G._defAp=G._defAp||{};const key=p+bk;if(G._defAp[key]===undefined)G._defAp[key]=appeal(DEF[p],bk);return G._defAp[key];}
function posOf(c){return PREVIEW&&c.id==='P'&&PREVIEW.pos?PREVIEW.pos:c.pos;}
function baseBlocs(c){return c.party==='D'?['prog','young','union']:c.party==='R'?['rural','faith','biz']:(G?cpOf(c).base:[]);}
function refreshStatic(c){const o=bioFx(c.bio);const add=(fx,m)=>{for(const k in fx)o[k]=(o[k]||0)+fx[k]*m;};
  for(const k in (c.minor||{})){const m=MINOR_BY[k],st=c.minor[k];if(!st)continue;add(st>0?m.yes:m.no,1);add(st>0?m.no:m.yes,-.5);}
  for(const k in (c.ebm||{}))o[k]=(o[k]||0)+c.ebm[k];
  if(c.bg&&BGS[c.bg]&&BGS[c.bg].fx)add(BGS[c.bg].fx,1);
  if(c.perk==='bipartisan')add({suburb:3},1);
  if(c.flaw==='polarizing'){baseBlocs(c).forEach(b=>o[b]=(o[b]||0)+2);o.suburb=(o.suburb||0)-4;}
  c.sbm=o;}
function bmOf(c,bk){return (c.bm[bk]||0)+(c.sbm&&c.sbm[bk]||0);}
function pull(p,bk){return p==='D'?PULL_D[bk]:p==='R'?-PULL_D[bk]:0;}
const P=()=>G.cands.P;
const isPrimary=()=>G.phase==='primary';
function cpOf(c){return (c&&c.cp)||G.customParty||{name:'Independent',color:'#888888',values:[0,0,0,0,0,0,0,0,0],base:[]};}
function partyName(p,c){return p==='D'?'Democratic':p==='R'?'Republican':cpOf(c).name;}
const PRIM_COLORS=['#7B5CC9','#C9822B','#1E9E8A','#C2397A','#6B8E23'];
function colorOf(id){
  const c=G.cands[id];
  if(G.phase==='primary'&&G.pColor&&G.pColor[id])return G.pColor[id];
  if(c.party==='D')return 'var(--dem)';if(c.party==='R')return 'var(--rep)';return cpOf(c).color;
}
function fullName(c){return (c.title?c.title+' ':'')+c.name;}
function sat(raw,a){if(raw<=0)return raw;const cap=8+ST[a].ev*.5;return cap*(1-Math.exp(-raw/cap));}
function moodD(a){if(!G||!G.drift)return 0;return (G.drift[a]||0)+(G.mood||0);}
function eff(id,a){const e=G.effort[id]&&G.effort[id][a];return e?e.r+e.a+e.g:0;}
function hits(id,a){const e=G.effort[id]&&G.effort[id][a];return e&&e.x?e.x:0;}
function addEffort(id,a,k,amt){G.effort[id]=G.effort[id]||{};const e=G.effort[id][a]=G.effort[id][a]||{r:0,a:0,g:0,x:0};if(amt<0&&k!=='g')k='x';e[k]=(e[k]||0)+amt;}
function onBallot(c,a){return c.party!=='C'||!!(c.ballot&&c.ballot[a]);}
function baseEnth(c){const pos=posOf(c);let d=0;for(let i=0;i<9;i++)d+=Math.abs(pos[i]-cpOf(c).values[i]);return clamp(1-d/10,.3,1);}
function strength(c,a){
  const s=ST[a],mix=MIX[s.p];let v=0;const pos=posOf(c);
  if(c.party==='D')v+=s.lean/2+.4+moodD(a)/2;else if(c.party==='R')v-=s.lean/2+.4+moodD(a)/2;else v-=54;
  BK.forEach((bk,i)=>{
    const ap=appeal(pos,bk);
    if(c.party!=='C')v+=mix[i]*(ap-defAp(c.party,bk))*60;
    else{v+=mix[i]*ap*40;if(cpOf(c).base.includes(bk))v+=mix[i]*100*baseEnth(c);}
    v+=mix[i]*bmOf(c,bk)*2;
  });
  let cred=c.cred;if(PREVIEW&&c.id==='P')cred+=PREVIEW.cred||0;
  v+=c.mom+(cred-60)*.15+(c.stats.cha-3)*.8;
  if(c.home===a)v+=c.perk==='local'?9:4;
  if(c.vp&&c.vp.home===a)v+=3;
  let raw=eff(c.id,a);
  if(PREVIEW){if(c.id==='P'){raw+=PREVIEW.eff[a]||0;v+=PREVIEW.mom;}if(PREVIEW.opp&&PREVIEW.opp[a]&&PREVIEW.opp[a][c.id])raw+=PREVIEW.opp[a][c.id];}
  let neg=hits(c.id,a);if(raw<0){neg+=raw;raw=0;}
  v+=sat(raw,a)+neg;
  return v;
}
function shares(a,ids){
  ids=ids||G.active;const arr=ids.map(id=>{const c=G.cands[id];return onBallot(c,a)?Math.exp(strength(c,a)/50):0;});
  const sum=arr.reduce((x,y)=>x+y,0);const o={};ids.forEach((id,i)=>o[id]=sum?arr[i]/sum:0);return o;
}
function project(sd,natSd){
  sd=sd||0;natSd=natSd||0;const nat={};G.active.forEach(id=>nat[id]=natSd?gauss()*natSd/100:0);const out={};
  ST_LIST.forEach(s=>{const sh=shares(s.a);
    if(sd||natSd){for(const id in sh){if(sh[id]>0)sh[id]=Math.max(.001,sh[id]+nat[id]+gauss()*sd/100);}const t=Object.values(sh).reduce((x,y)=>x+y,0);for(const id in sh)sh[id]/=t;}
    out[s.a]=sh;});
  return out;
}
function summarize(proj){
  const ev={},pop={},lead={};let tot=0;G.active.forEach(id=>{ev[id]=0;pop[id]=0;});
  ST_LIST.forEach(s=>{const sh=proj[s.a];let best=null,bv=-1,second=0;
    for(const id in sh){pop[id]+=sh[id]*s.ev;if(sh[id]>bv){second=Math.max(bv,0);bv=sh[id];best=id;}else if(sh[id]>second)second=sh[id];}
    tot+=s.ev;ev[best]+=s.ev;lead[s.a]={id:best,margin:bv-second};});
  for(const id in pop)pop[id]/=tot;
  return {ev,pop,lead};
}
function pollSd(){return {easy:.6,normal:1.3,hard:2.4}[G.diff];}
function noisy(truth,biasKey){
  G[biasKey]=G[biasKey]||{};const sd=pollSd();const out={};
  for(const a in truth){const b=G[biasKey][a]=G[biasKey][a]||{};const sh={};let t=0;
    for(const id in truth[a]){b[id]=(b[id]||0)*.7+gauss()*sd/100*.55;sh[id]=truth[a][id]>0?Math.max(.001,truth[a][id]+b[id]):0;t+=sh[id];}
    for(const id in sh)sh[id]/=t;out[a]=sh;}
  return out;
}
function computePolls(){G.polls=noisy(project(0,0),'pollBias');G.pollSum=summarize(G.polls);}

/* primary model */
const PRIM_CORE={D:[[6,-1,1.0],[4,-1,.6],[1,-1,.6],[3,-1,.6]],R:[[2,1,.9],[3,1,.75],[0,1,.6],[6,1,.6]]};
function primThr(party,j){return PRIM_CORE[party][j][2]+(G.pth?G.pth[party][j]:0);}
function pStrength(c,a){
  const s=ST[a],mix=MIX[s.p],w=PRIMW[c.party];const pos=posOf(c);const core=PRIM_CORE[c.party];
  let cs=0;core.forEach(([i,dir],j)=>{const short=Math.max(0,primThr(c.party,j)-pos[i]*dir);cs+=clamp(1-short*1.3,-1,1);});cs/=core.length;
  const coreIdx=core.map(x=>x[0]);let os=0,on=0;for(let i=0;i<9;i++){if(coreIdx.includes(i))continue;os+=1-Math.max(0,Math.abs(pos[i]-DEF[c.party][i])-1)/2;on++;}os/=on;
  let el=0,reg=0,tot=0;BK.forEach((bk,i)=>{const ap=appeal(pos,bk);el+=ap/8;const ww=mix[i]*w[bk];tot+=ww;reg+=ww*(ap*20+bmOf(c,bk)*2);});reg/=tot;
  let v=cs*26+os*8+el*22+reg;
  v+=c.mom*1.2+(c.stats.cha-3)*2+(c.home===a?8:0)+(c.pq||0)+(c.cred-60)*.1;
  let raw=eff(c.id,a);if(PREVIEW){if(c.id==='P'){raw+=PREVIEW.eff[a]||0;v+=PREVIEW.mom*1.2;}if(PREVIEW.opp&&PREVIEW.opp[a]&&PREVIEW.opp[a][c.id])raw+=PREVIEW.opp[a][c.id];}
  let neg2=hits(c.id,a);if(raw<0){neg2+=raw;raw=0;}v+=sat(raw,a)+neg2;
  return v;
}
function pShares(a){const ids=G.primaryField;const arr=ids.map(id=>Math.exp(pStrength(G.cands[id],a)/18));const s=arr.reduce((x,y)=>x+y,0);const o={};ids.forEach((id,i)=>o[id]=arr[i]/s);return o;}
function pTruth(){const o={};ST_LIST.forEach(s=>o[s.a]=pShares(s.a));return o;}
function pPolls(){G.pPolls=noisy(pTruth(),'pBias');}
function pNational(polls){const o={};G.primaryField.forEach(id=>o[id]=0);let t=0;ST_LIST.forEach(s=>{for(const id in polls[s.a])o[id]+=polls[s.a][id]*s.ev;t+=s.ev;});for(const id in o)o[id]/=t;return o;}

function blocSupport(){
  const out={};
  BK.forEach(bk=>{
    const sc=G.active.map(id=>{const c=G.cands[id];const pos=posOf(c);let v;
      if(c.party!=='C')v=pull(c.party,bk)*60+(appeal(pos,bk)-defAp(c.party,bk))*60;
      else v=-54+(cpOf(c).base.includes(bk)?100*baseEnth(c):0)+appeal(pos,bk)*40;
      v+=bmOf(c,bk)*2+c.mom;return Math.exp(v/50);});
    const s=sc.reduce((x,y)=>x+y,0);out[bk]=sc[G.active.indexOf('P')]/s;});
  return out;
}
function issueGap(pos,bk,i){return Math.max(0,Math.abs(pos[i]-idealOf(bk,i))-TOL);}
function worstIssue(pos,bk){let wi=0,wd=-1;for(let i=0;i<9;i++){const d=issueGap(pos,bk,i)*WEIGHT[bk][i];if(d>wd){wd=d;wi=i;}}return {i:wi,gap:issueGap(pos,bk,wi)};}
function hintLine(bk){const c=P();const w=worstIssue(c.pos,bk);const n=ISSUES[w.i].n.toLowerCase();
  if(w.gap>.6)return `You lost me on ${n}.`;if(w.gap>0)return `You’re getting closer on ${n}, but not there yet.`;
  let best=0,bw=-1;for(let i=0;i<9;i++)if(WEIGHT[bk][i]>bw){bw=WEIGHT[bk][i];best=i;}return `You’re right where we want you on ${ISSUES[best].n.toLowerCase()}.`;}
/* ================= Ticker & text ================= */
let TICK_CAP=null;
function tick(text){const it={net:pick(NETS),text};G.ticker.unshift(it);G.ticker=G.ticker.slice(0,14);if(TICK_CAP)TICK_CAP.push(it);}
function mainOpp(){
  if(!G)return null;
  if(G.phase==='primary'){const nat=pNational(G.pPolls);return G.primaryField.filter(i=>i!=='P').sort((a,b)=>nat[b]-nat[a])[0];}
  const opps=G.active.filter(i=>i!=='P');if(!opps.length)return null;
  if(!G.pollSum)return opps[0];return opps.slice().sort((a,b)=>G.pollSum.pop[b]-G.pollSum.pop[a])[0];
}
function fill(str,extra){
  const opp=mainOpp();
  return str.replace(/\{opp\}/g,opp?G.cands[opp].name:'your opponent').replace(/\{vp\}/g,P().vp?P().vp.name:'your running mate')
   .replace(/\{hobby\}/g,P().bio&&P().bio.hobbies?HOBBIES[P().bio.hobbies[0]].n.toLowerCase():'golf').replace(/\{name\}/g,P().name).replace(/\{state\}/g,extra&&extra.state?extra.state:'Ohio').replace(/\{bloc\}/g,extra&&extra.bloc?BNAME[extra.bloc].toLowerCase():'voters');
}

/* ================= Effects ================= */
function dmult(neg){if(!neg)return 1;return {easy:.7,normal:1,hard:1.3}[G.diff];}
function shiftIssue(i,dir,amt,out,label){
  const c=P();const cur=c.pos[i];amt=amt||.5;
  if(Math.abs(cur)>=.3&&Math.sign(cur)!==dir){const pen={easy:5,normal:8,hard:13}[G.diff];c.cred=clamp(c.cred-pen,0,100);c.pos[i]=clamp(cur+dir*amt,-2,2);G.flips++;out.push(['Flip-flop on '+ISSUES[i].n.toLowerCase(),-pen,'flip']);tick(`${c.name} flip-flops on ${ISSUES[i].n.toLowerCase()}; opponents rush out new ads`);}
  else if(Math.abs(cur)<.3){c.pos[i]=clamp(cur+dir*amt,-2,2);out.push(['Now: '+posText(i,c.pos[i]),0,'info']);}
  else{c.cred=clamp(c.cred+2,0,100);if(Math.abs(cur)<1.2)c.pos[i]=clamp(cur+dir*.2,-2,2);out.push(['Consistent on '+ISSUES[i].n.toLowerCase(),2]);}
}
function applyFx(fx,extra){
  const c=P();const out=[];extra=extra||{};
  if(fx.blocs)for(const k in fx.blocs){const key=k==='$'?extra.bloc:k;const v=fx.blocs[k]*dmult(fx.blocs[k]<0);c.bm[key]=(c.bm[key]||0)+v;out.push([BNAME[key],v]);}
  if(fx.mom){const v=fx.mom*dmult(fx.mom<0);c.mom=clamp(c.mom+v,-10,10);out.push(['Momentum',v]);}
  if(fx.cred){const v=fx.cred*dmult(fx.cred<0);c.cred=clamp(c.cred+v,0,100);out.push(['Credibility',v]);}
  if(fx.cash){G.cash=Math.max(0,G.cash+fx.cash);out.push(['Cash',fx.cash,'$']);}
  if(fx.exposure){if(G.secretState==='hidden'){G.exposure=clamp(G.exposure+fx.exposure,0,100);out.push(['Secret exposure',fx.exposure,'bad']);}
    else{G.secretState='hidden';G.secret='You took foreign money through shell companies';G.exposure=fx.exposure;out.push(['New secret',fx.exposure,'bad']);}}
  if(fx.issue)shiftIssue(fx.issue[0],fx.issue[1],.5,out);
  if(fx.minor){const [k,st]=fx.minor;const prev=(c.minor||{})[k];c.minor=c.minor||{};
    if(prev&&prev!==st){const pen={easy:2,normal:4,hard:6}[G.diff];c.cred=clamp(c.cred-pen,0,100);out.push(['Switched on '+MINOR_BY[k].n.toLowerCase(),-pen,'flip']);}
    c.minor[k]=st;refreshStatic(c);out.push([(st>0?'For: ':'Against: ')+MINOR_BY[k].n,0,'info']);}
  if(fx.opp){const o=mainOpp();if(o){const oc=G.cands[o];if(fx.opp.mom){oc.mom=clamp(oc.mom+fx.opp.mom,-10,10);out.push([oc.name+' momentum',fx.opp.mom,'bad']);}if(fx.opp.cred){oc.cred=clamp(oc.cred+fx.opp.cred,0,100);out.push([oc.name+' credibility',fx.opp.cred,'bad']);}}}
  if(fx.states)for(const a in fx.states){addEffort('P',a,'g',fx.states[a]);out.push([ST[a].n,fx.states[a]]);}
  if(fx.homeBoost){addEffort('P',c.home,'g',fx.homeBoost);out.push([ST[c.home].n+' (home)',fx.homeBoost]);}
  if(fx.mood){G.mood=(G.mood||0)+fx.mood*(G.incumbent==='D'?1:-1);out.push(['National mood turns on the party in power',0,'info']);}
  if(fx.setFlag){G.flags[fx.setFlag]=G.week;if(fx.setFlag==='raccoon')G.bandit=true;}
  if(fx.gaffe&&rnd()<fx.gaffe+(c.flaw==='gaffe'?.15:0))out.push(...gaffe());
  return out;
}
function gaffe(){const c=P();const v=-2.5*dmult(true);c.mom=clamp(c.mom+v,-10,10);
  const line=fill(pick(GAFFES),{state:pick(ST_LIST).n});tick(line);return [['Gaffe: '+line,v,'flip']];}
function fxHTML(list){
  if(!list.length)return '<div class="fx"><span>No real change</span></div>';
  return '<div class="fx">'+list.map(([n,v,k])=>{
    if(k==='info')return `<span>${esc(n)}</span>`;
    if(k==='$')return `<span class="${v>=0?'up':'down'}">${esc(n)} ${v>=0?'+':'−'}${money(Math.abs(v))}</span>`;
    const bad=k==='bad'?v>0:v<0;const vs=v===0?'':` ${v>0?'+':'−'}${Math.abs(v).toFixed(v%1?1:0)}`;
    return `<span class="${bad?'down':'up'}">${esc(n)}${vs}</span>`;}).join('')+'</div>';
}

/* ================= Game start ================= */
// Setup choices never draw from a running game's seeded RNG.
function newSetup(){const g=G;G=null;try{return newSetupInner();}finally{G=g;}}
function newSetupInner(){return {step:0,era:'present',party:'D',cp:{name:'',color:CP_COLORS[0],values:[0,0,0,0,0,0,0,0,0],base:[]},name:'',home:'PA',bg:'governor',perk:'silver',flaw:'gaffe',secret:'random',pos:DEF.D.slice(),diff:'normal',pace:'standard',primaries:true,err:'',bio:randomBio(),minor:{}};}
function mkCand(r){const c={id:r.id,party:r.party,name:r.name,title:r.title,home:r.home,pos:r.pos.slice(),stats:{...r.stats},pq:r.pq+(rnd()*4-2),blurb:r.blurb,quotes:r.quotes,cred:60,mom:0,bm:{},perk:r.perk,flaw:r.flaw,arch:r.arch,bio:{...r.bio},secret:r.secret,minor:{},ebm:{}};
  shuffle(MINOR).slice(0,3).forEach(m=>c.minor[m.k]=rnd()<.5?1:-1);refreshStatic(c);return c;}
function startGame(){
  const S=UI.S,bg=BGS[S.bg];
  G={rng:(S.seed!==undefined?S.seed:newSeed())|0};
  Object.assign(G,{v:5,diff:S.diff,pace:S.pace,cands:{},effort:{},ticker:[],cash:20+(bg.cash||0),staff:'standard',apWeek:4,prep:0,plan:[],
    exposure:0,secret:null,secretState:'none',flips:0,scandals:0,confessed:false,flags:{},dirt:{},strings:[],donorBlock:0,revealed:[],endorsed:{},usedEndorsers:[],
    debates:{won:0,lost:0,draw:0,total:0},usedEvents:[],pollHistory:[],customParty:null,ballot:{},week:1,round:0,lostRound1:false,trailedFinal:false,intern:pick(INTERN),notes:[],
    ish:{},pth:{D:[0,0,0,0],R:[0,0,0,0]},govState:pick(BATTLEGROUND),released:false});
  G.seenAtStart=(store.get('politicaster.seen')||[]).slice();
  BK.forEach(b=>G.ish[b]=IDEAL[b].map(()=>(rnd()*2-1)*.25));
  ['D','R'].forEach(p=>G.pth[p]=G.pth[p].map(()=>(rnd()*2-1)*.25));
  if(S.party==='C')G.customParty={name:S.cp.name.trim(),color:S.cp.color,values:S.cp.values.slice(),base:S.cp.base.slice()};
  const stats={...bg.stats};if(S.perk==='silver')stats.deb++;
  const st2=S.stats?{...S.stats}:stats;if(S.perk==='silver'&&S.stats)st2.deb=Math.min(6,st2.deb+1);
  G.cands.P={id:'P',party:S.party,name:S.name.trim(),title:bg.title,home:S.home,pos:S.pos.slice(),stats:st2,cred:bg.cred+(S.perk==='bipartisan'?3:0),mom:bg.mom||0,bm:{},perk:S.perk,flaw:S.flaw,bg:S.bg,vp:null,pq:5,bio:{...S.bio},minor:{...S.minor},ebm:{}};
  ROSTER=generateRoster();G.roster=ROSTER;G.incumbent=rnd()<.5?'D':'R';G.mood=0;G.drift={};ST_LIST.forEach(s=>G.drift[s.a]=0);G.news=[];G.recentEv=[];
  if(S.bg==='cabinet')G.prep=1;UI.slot=pickSlot();
  if(S.party==='C')G.cands.P.cp=G.customParty;
  refreshStatic(G.cands.P);
  ROSTER.forEach(r=>G.cands[r.id]=mkCand(r));
  if(S.secret!=='none'){G.secret=S.secret==='random'?pick(SECRETS):SECRETS[+S.secret];G.secretState='hidden';G.exposure=10;}
  tick(`${fullName(P())} announces a run for president${S.party==='C'?' under the '+G.customParty.name+' banner':''}`);
  if(!store.get('politicaster.tutDone'))UI.tutOffer=true;
  UI.mq=[];
  if(S.party!=='C'&&S.primaries){
    G.phase='primary';G.round=1;G.rounds=PRIMARY_ROUNDS.length;
    const r=rnd();const n=r<.3?2:r<.6?3:r<.85?4:5;
    const rivals=shuffle(ROSTER.filter(x=>x.party===S.party)).slice(0,n).map(x=>x.id);
    G.primaryField=['P',...rivals];G.pColor={};rivals.forEach((id,i)=>G.pColor[id]=PRIM_COLORS[i]);G.delegates={P:0};rivals.forEach(x=>G.delegates[x]=0);G.active=G.primaryField.slice();G.dropped=[];
    pPolls();G.debateRounds=S.pace==='standard'?[2]:[];
    UI.screen='game';
    tick(`${n} rivals enter the ${partyName(S.party)} primary: ${rivals.map(x=>G.cands[x].name).join(', ')}`);
    weekStart();
  }else beginGeneral();
}
function beginGeneral(){
  G.phase='general';G.week=1;G.weeks=G.pace==='quick'?8:12;G.debateWeeks=G.pace==='quick'?[5]:[4,7,10];G.vpDebateWeek=G.pace==='quick'?3:6;G.octWeek=G.weeks-1;
  const p=P();const opps=[];
  if(p.party!=='D')opps.push(pick(ROSTER.filter(r=>r.party==='D')).id);
  if(p.party!=='R')opps.push(pick(ROSTER.filter(r=>r.party==='R')).id);
  G.active=['P',...opps];G.effort={};G.plan=[];
  opps.forEach(id=>{const o=G.cands[id];o.mom=3;const keep=Math.floor(rnd()*9);o.pos=DEF[o.party].map((v,i)=>i===keep?o.pos[i]:v);o.vp={name:pick(VP_NAMES),home:pick(BATTLEGROUND)};});
  p.mom=p.mom*.5;
  if(p.party==='C'){G.ballotDeadline=G.pace==='quick'?3:4;ST_LIST.forEach(s=>{if(s.ev>=10||Math.abs(s.lean)<=4)(p.ballot=p.ballot||{})[s.a]=true;});}
  computePolls();G.pollHistory=[{w:0,sh:{...G.pollSum.pop}}];G.prevBloc=blocSupport();
  opps.forEach(id=>tick(`${fullName(G.cands[id])} clinches the ${partyName(G.cands[id].party)} nomination and gets a convention bounce`));
  UI.screen='game';UI.mq=[];UI.modal={type:'vp',opts:vpOptions()};render();
}
function vpOptions(){const names=shuffle(VP_NAMES);const bag=shuffle(VP_BAGGAGE);return VP_TYPES.map((t,i)=>({...t,name:names[i],home:t.k==='swing'?pick(BATTLEGROUND.filter(s=>s!==P().home)):pick(ST_LIST.filter(s=>s.a!=='DC'&&s.a!==P().home)).a,bio:randomBio(),baggage:rnd()<.45?bag[i]:null,vetted:false}));}
function platformFight(){
  const p=P();const f=pick(PLATFORM_FIGHTS[p.party]);const base=p.party==='D'?['prog','young','union']:p.party==='R'?['rural','faith','biz']:G.customParty.base;
  return {type:'platform',f,base};
}
function platformChoice(k){
  const m=UI.modal,f=m.f,p=P();const list=[];
  if(k==='accept'){if(f.i!==null){const from=p.pos[f.i];p.pos[f.i]=f.to;list.push(['Now: '+posText(f.i,f.to),0,'info']);if(Math.abs(f.to-from)>.6)list.push(['Moderates notice',0,'info']);}
    m.base.forEach(b=>{p.bm[b]=(p.bm[b]||0)+3;list.push([BNAME[b],3]);});p.bm.suburb=(p.bm.suburb||0)-2;list.push([BNAME.suburb,-2]);}
  else if(k==='compromise'){if(f.i!==null){p.pos[f.i]=(p.pos[f.i]+f.to)/2;list.push(['Now: '+posText(f.i,p.pos[f.i]),0,'info']);}m.base.forEach(b=>{p.bm[b]=(p.bm[b]||0)+1;});list.push(['Base groups',1]);}
  else{m.base.forEach(b=>{p.bm[b]=(p.bm[b]||0)-3;});list.push(['Base groups',-3]);p.cred=clamp(p.cred+3,0,100);list.push(['Credibility',3]);p.mom=clamp(p.mom-1,-10,10);list.push(['Momentum',-1]);}
  tick(k==='accept'?`${p.name} embraces ${f.n} at the convention`:k==='refuse'?`Floor fight! ${p.name} rejects ${f.n}`:`${p.name} strikes a deal with ${f.wing} at the convention`);
  if(G.unity&&G.unity<0){m.base.forEach(b=>{p.bm[b]=(p.bm[b]||0)+G.unity;});list.push(['Bitter primary voters',G.unity]);}
  UI.modal={type:'note',title:'The convention wraps up',html:`<p>${k==='accept'?'The base is fired up. Swing voters raise an eyebrow.':k==='refuse'?'A messy floor fight, but you look independent.':'Nobody gets everything, so nobody is furious.'}</p>${fxHTML(list)}`,then:'weekStart'};render();
}
/* ================= Actions & planning ================= */
const ACTIONS={
 rally:{n:'Hold a rally',d:'Free. A solid boost in one state that fades over a few weeks.',target:true},
 ad:{n:'Buy TV ads',d:'A bigger boost in one state. Price depends on state size.',target:true},
 attack:{n:'Run an attack ad',d:'Knock down your strongest opponent in one state. Costs a little credibility.',target:true},
 ground:{n:'Build ground game',d:'Small, but it never fades. Best in states you’ll fight over.',target:true},
 spouse:{n:'Send your celebrity spouse',d:'Free. Your famous spouse rallies one state for you.',target:true},
 fund:{n:'Hold a fundraiser',d:'Raise cash for ads.'},
 donor:{n:'Big-donor dinner',d:'Lots of cash, but donors may attach strings.'},
 interview:{n:'Do a national interview',d:'Momentum everywhere. Small gaffe risk.'},
 speech:{n:'Give a policy speech',d:'Shift one issue by up to 25%. Once per week.',modal:true},
 poll:{n:'Commission an internal poll',d:'Reveals one hidden voter threshold.'},
 endorse:{n:'Court an endorsement',d:'Win over a group or public figure.',modal:true},
 oppo:{n:'Opposition research',d:'Dig for dirt on an opponent.',modal:true},
 release:{n:'Release the dirt',d:'Drop what you found on an opponent.',modal:true},
 prep:{n:'Debate prep',d:'Better odds on every debate answer.'},
 bury:{n:'Bury your secret',d:'Lower exposure. A staffer might leak.'},
 confess:{n:'Come clean',d:'Take a smaller hit now, on your own terms.'},
 petition:{n:'Petition drive',d:'Get your party on one state’s ballot.',target:true}
};
const STAFF={lean:{n:'Lean',ap:3,cost:.5},standard:{n:'Standard',ap:4,cost:1.5},jugg:{n:'Juggernaut',ap:5,cost:3}};
const BASE_COST={rally:0,ground:.5,spouse:0,fund:0,donor:0,interview:0,speech:0,poll:2.5,endorse:.5,prep:0,bury:1.5,confess:0,petition:.3,release:0};
function costOf(k,a,it){let base;if(k==='ad')base=.8+(a?ST[a].ev:10)*.04;else if(k==='attack')base=.7+(a?ST[a].ev:10)*.035;else if(k==='oppo')base=it&&it.method==='dirty'?.8:2;else base=BASE_COST[k]||0;return base*(P().flaw==='spender'?1.25:1);}
function incomeOf(k){const c=P();const m=c.flaw==='cheapskate'?.75:1;if(k==='fund')return (3.5+c.stats.fund*1.4)*(c.perk==='rolodex'?1.4:1)*m;if(k==='donor')return 10*(c.perk==='rolodex'?1.3:1)*m;return 0;}
function staffCost(){return STAFF[G.staff].cost;}
function actionEffect(k){
  const c=P();const boost=c.party==='C'&&!isPrimary()?1.25:1;
  if(k==='rally'){let amt=5+(c.stats.cha-3)*.8;if(c.flaw==='wooden')amt*=.6;return {eff:amt*boost};}
  if(k==='spouse')return {eff:4*boost};
  if(k==='ad')return {eff:6*boost};
  if(k==='ground')return {eff:(c.bg==='organizer'?3:2)*(c.perk==='guru'?1.6:1)*boost};
  if(k==='interview')return {mom:(1.2+(c.stats.cha-3)*.5)*(c.bg==='host'?1.5:1)*(c.perk==='darling'?1.4:1)};
  return {};
}
function speechCost(from,to){const d=Math.abs(to-from);if(d<=.2)return 1;return Math.round(d*14*dmult(true));}
function buildPreview(plan){const p={eff:{},mom:0,opp:{},cred:0,pos:null};
  plan.forEach(it=>{const e=actionEffect(it.k);if(e.eff)p.eff[it.a]=(p.eff[it.a]||0)+e.eff;if(e.mom)p.mom+=e.mom;
    if(it.k==='attack'&&it.opp){p.opp[it.a]=p.opp[it.a]||{};p.opp[it.a][it.opp]=(p.opp[it.a][it.opp]||0)-5;p.cred-=.5;}
    if(it.k==='speech'){p.pos=(p.pos||P().pos).slice();p.pos[it.i]=it.to;p.cred-=speechCost(it.from,it.to);}});
  return p;}
function withPlan(plan,fn){const s=PREVIEW;PREVIEW=buildPreview(plan);try{return fn();}finally{PREVIEW=s;}}
function myShare(a){return isPrimary()?pShares(a).P:shares(a).P;}
function leadOppIn(a){const sh=isPrimary()?pShares(a):shares(a);return Object.entries(sh).filter(([k])=>k!=='P').sort((x,y)=>y[1]-x[1])[0][0];}
function mkItem(k,a){const it={k,a};if(k==='attack')it.opp=leadOppIn(a);return it;}
function gainFor(k,a,plan){plan=plan||G.plan;const before=withPlan(plan,()=>myShare(a));const after=withPlan(plan.concat([mkItem(k,a)]),()=>myShare(a));return after-before;}
function cashAfter(plan){plan=plan||G.plan;let c=G.cash-staffCost();plan.forEach(it=>{c+=incomeOf(it.k)-costOf(it.k,it.a,it);});return c;}
function apLeft(){return G.apWeek-G.plan.length;}
function planned(k){return G.plan.filter(i=>i.k===k).length;}
function opponents(){return (isPrimary()?G.primaryField:G.active).filter(i=>i!=='P');}
function availEndorsers(){return ENDORSERS.filter(e=>!G.usedEndorsers.includes(e.id)&&!G.plan.some(p=>p.k==='endorse'&&p.id===e.id));}
function endorseMet(e){const c=P();if(!e.req)return true;const r=e.req;if(r.cred!==undefined)return c.cred>=r.cred&&(e.id!=='ledger'||G.flips<=2);
  const v=c.pos[r.i];return r.min!==undefined?v>=r.min:v<=r.max;}
function endorseChance(e){const c=P();if(e.id==='popstar'){const ys=isPrimary()?.4:blocSupport().young;return clamp(ys*1.2,.15,.85);}return clamp((endorseMet(e)?.72:.12)+c.mom*.015,.05,.9);}
function dirtReady(){return opponents().filter(id=>(G.dirt[id]||0)>=100&&!G.plan.some(p=>p.k==='release'&&p.target===id)&&!(G.releasedOn||[]).includes(id));}
function actionAvail(k){
  const c=P();
  if(k==='prep'){const up=isPrimary()?G.debateRounds.some(r=>r>=G.round):G.debateWeeks.some(w=>w>G.week);return up&&G.prep+planned('prep')<3;}
  if(k==='bury')return G.secretState==='hidden'&&!planned('confess')&&!planned('bury');
  if(k==='confess')return G.secretState==='hidden'&&!planned('bury')&&!planned('confess');
  if(k==='petition')return !isPrimary()&&c.party==='C'&&G.week<=G.ballotDeadline;
  if(k==='ground')return !isPrimary();
  if(k==='spouse')return c.bio&&c.bio.marital==='celebspouse'&&!planned('spouse');
  if(k==='speech')return !planned('speech');
  if(k==='donor')return (G.turn||0)>=(G.donorBlock||0);
  if(k==='endorse')return !isPrimary()&&availEndorsers().length>0;
  if(k==='release')return dirtReady().length>0;
  if(k==='poll')return !planned('poll');
  return true;
}
function whyNot(k,it){
  if(apLeft()<=0)return 'No actions left this week. Remove one from your plan to swap it.';
  {const cost=k==='oppo'?costOf('oppo',null,{method:'dirty'}):costOf(k,null,it);if(!ACTIONS[k].target&&cost>0&&cashAfter()-cost+incomeOf(k)<0)return 'Not enough cash after your current plan and staff costs.';}
  return '';
}
function canTarget(k,a){
  if(isPrimary()&&!PRIMARY_ROUNDS[G.round-1].st.includes(a))return false;
  if(k==='petition')return !onBallot(P(),a)&&!G.plan.some(i=>i.k==='petition'&&i.a===a);
  if(!isPrimary()&&!onBallot(P(),a)&&!G.plan.some(i=>i.k==='petition'&&i.a===a))return false;
  const cost=costOf(k,a);return cost<=0||cashAfter()-cost>=0;
}
function startAction(k){
  UI.flash='';
  const w=whyNot(k);if(w){UI.flash=w;render();return;}
  if(ACTIONS[k].target){UI.pending=UI.pending===k?null:k;render();return;}
  if(ACTIONS[k].modal){UI.pending=null;UI.modal=pickModal(k);render();return;}
  addPlan(k,null);
}
function pickModal(k){
  if(k==='speech'){const i=0;return {type:'speech',i,to:P().pos[i]};}
  if(k==='oppo')return {type:'oppo',target:opponents()[0],method:'clean'};
  if(k==='endorse')return {type:'endorse'};
  if(k==='release')return {type:'release'};
}
function addPlan(k,a,extra){
  if(apLeft()<=0)return;
  const item=Object.assign(mkItem(k,a),extra||{});
  {const cost=costOf(k,a,item);if(cost>0&&cashAfter()-cost+incomeOf(k)<0){UI.flash='Not enough cash for that after staff costs.';render();return;}}
  if(a&&ACTIONS[k].target&&k!=='petition')item.gain=gainFor(k,a);
  G.plan.push(item);UI.pending=null;UI.flash='';render();
}
function removePlan(i){
  const it=G.plan[i];const rest=G.plan.filter((_,j)=>j!==i);
  if(incomeOf(it.k)>0&&cashAfter(rest)<0){UI.flash='That fundraiser is paying for something in your plan. Remove an ad first.';render();return;}
  G.plan=rest;
  G.plan.forEach(p=>{if(p.a&&p.k!=='petition'&&ACTIONS[p.k].target)p.gain=gainFor(p.k,p.a,G.plan.filter(q=>q!==p));});
  UI.flash='';render();
}
function setStaff(k){
  if(STAFF[k].ap+(G.apWeek-STAFF[G.staff].ap)<G.plan.length){UI.flash='Remove some planned actions before cutting staff.';render();return;}
  G.apWeek+=STAFF[k].ap-STAFF[G.staff].ap;G.staff=k;UI.flash='';render();
}
function planLabel(it){
  if(it.k==='speech')return `Policy speech on ${ISSUES[it.i].n.toLowerCase()}`;
  if(it.k==='oppo')return `${it.method==='dirty'?'Dirty':'Clean'} oppo research on ${G.cands[it.target].name}`;
  if(it.k==='release')return `Release the dirt on ${G.cands[it.target].name}`;
  if(it.k==='endorse')return `Court: ${ENDORSERS.find(e=>e.id===it.id).n}`;
  return ACTIONS[it.k].n+(it.a?' in '+ST[it.a].n:'');}
function planEffectText(it){
  const k=it.k;
  if(it.gain!==undefined)return `About ${sgn(it.gain*100)} pts for you in ${ST[it.a].n}${k==='attack'?' (hits '+G.cands[it.opp].name+')':''}`;
  if(k==='petition')return `On the ballot in ${ST[it.a].n} (${ST[it.a].ev} electoral votes)`;
  if(k==='fund'||k==='donor')return `+${money(incomeOf(k))}${k==='donor'?', donors may attach strings':''}`;
  if(k==='interview')return `About ${sgn(actionEffect('interview').mom)} momentum everywhere`;
  if(k==='prep')return `Debate odds +7% per answer`;
  if(k==='bury')return `Exposure −20 (15% chance of a leak)`;
  if(k==='confess')return `Secret gone for good; momentum −3, credibility +3`;
  if(k==='speech')return `${posText(it.i,it.from)} → ${posText(it.i,it.to)}. Credibility −${speechCost(it.from,it.to)}${Math.abs(it.to-it.from)>=.4?' (counts as a flip-flop)':''}`;
  if(k==='poll')return 'Reveals one voter group’s hidden comfort zone';
  if(k==='oppo')return it.method==='dirty'?'Dirt +55%. 20% chance it leaks and backfires':'Dirt +30%. Safe';
  if(k==='release')return `Big hit to ${G.cands[it.target].name}${G.phase==='general'&&G.weeks-G.week<=2?' (October timing: extra damage)':''}`;
  if(k==='endorse'){const e=ENDORSERS.find(x=>x.id===it.id);return `About ${Math.round(endorseChance(e)*100)}% chance they say yes`;}
  return '';
}
function actionCostText(k){
  if(k==='ad')return '$1–3M';if(k==='attack')return '$1–2.6M';if(k==='oppo')return '$0.8–2M';
  const inc=incomeOf(k);if(inc)return '+'+money(inc);
  const c=costOf(k);return c>0?money(c):'Free';
}
/* ================= Marge (coach) ================= */
function margeCandidates(plan){
  const c=P();const prim=isPrimary();const list=[];
  const valid=ST_LIST.filter(s=>prim?PRIMARY_ROUNDS[G.round-1].st.includes(s.a):onBallot(c,s.a)||plan.some(i=>i.k==='petition'&&i.a===s.a));
  const cashNow=cashAfter(plan);
  const truth=withPlan(plan,()=>{const o={};valid.forEach(s=>o[s.a]=prim?pShares(s.a):shares(s.a));return o;});
  const weeksLeft=prim?1:Math.max(1,G.weeks-G.week+1);
  valid.forEach(s=>{
    const sh=truth[s.a];const mine=sh.P;const best=Math.max(...Object.entries(sh).filter(([k])=>k!=='P').map(([,v])=>v));const margin=mine-best;
    const weight=prim?s.ev*10:s.ev*Math.exp(-Math.abs(margin)/.045);
    if(weight<.3)return;
    ['rally','ad','attack','ground','spouse'].forEach(k=>{
      if(!actionAvail(k))return;
      if(k==='ground'&&weeksLeft<4)return;
      if(cashNow-costOf(k,s.a)<0)return;
      const g=gainFor(k,s.a,plan);let val=g*weight*100;
      if(k==='ad'||k==='attack')val-=costOf(k,s.a)*.6;
      if(k==='attack')val-=1.5;
      if(k==='ground')val*=Math.min(3,weeksLeft/3);
      const why=prim?`${s.n} awards ${s.ev*10} delegates, and you’re at ${pct(mine)}%.`:(margin<0?`You’re down ${pct(-margin)} in ${s.n}, worth ${s.ev} electoral votes.`:`You’re only up ${pct(margin)} in ${s.n}. Protect its ${s.ev} electoral votes.`);
      list.push({k,a:s.a,val,why,gain:g});
    });
  });
  if(!prim&&c.party==='C'&&G.week<=G.ballotDeadline){
    ST_LIST.filter(s=>!onBallot(P(),s.a)&&!plan.some(i=>i.k==='petition'&&i.a===s.a)).forEach(s=>{
      const bl=P().ballot;const tmp=bl[s.a];bl[s.a]=true;const sh=shares(s.a);bl[s.a]=tmp;
      const best=Math.max(...Object.entries(sh).filter(([k])=>k!=='P').map(([,v])=>v));
      list.push({k:'petition',a:s.a,val:s.ev*Math.exp(-Math.abs(sh.P-best)/.08)*3,why:`You’re not on the ballot in ${s.n} yet, and you could compete there.`});});
  }
  if(cashNow<5)list.push({k:'fund',val:30-cashNow*4,why:`Cash is low (${money(cashNow)} after this plan and staff costs). Ads need money.`});
  const debSoon=prim?G.debateRounds.some(r=>r>=G.round&&r-G.round<=1):G.debateWeeks.some(w=>w>G.week&&w-G.week<=2);
  if(debSoon&&G.prep+plan.filter(i=>i.k==='prep').length<2&&actionAvail('prep'))list.push({k:'prep',val:28,why:'A debate is coming up soon. Each prep session improves your odds.'});
  if(G.secretState==='hidden'&&G.exposure>=55&&!plan.some(i=>i.k==='bury'||i.k==='confess'))list.push({k:G.exposure>=80?'confess':'bury',val:G.exposure/2,why:`Your secret is at ${Math.round(G.exposure)}% exposure.`});
  if(c.mom<1&&!plan.some(i=>i.k==='interview'))list.push({k:'interview',val:8,why:'Your momentum is flat. An interview builds it everywhere.'});
  if(G.revealed.length<2&&cashNow>=6&&!plan.some(i=>i.k==='poll'))list.push({k:'poll',val:prim?14:11,why:'We’re guessing where voters draw their lines. An internal poll would tell us.'});
  if(!prim&&actionAvail('endorse')){const e=availEndorsers().filter(endorseMet).sort((x,y)=>endorseChance(y)-endorseChance(x))[0];if(e&&cashNow>=1)list.push({k:'endorse',id:e.id,val:18,why:`${e.n} would likely back you (${Math.round(endorseChance(e)*100)}% chance).`});}
  if(weeksLeft>2&&cashNow>=3){const o=opponents().filter(id=>(G.dirt[id]||0)<100).sort((a,b)=>(G.dirt[b]||0)-(G.dirt[a]||0))[0];if(o&&!plan.some(i=>i.k==='oppo'))list.push({k:'oppo',target:o,method:'clean',val:9,why:`Dirt on ${G.cands[o].name} is at ${Math.round(G.dirt[o]||0)}%. Keep digging.`});}
  const rd=dirtReady()[0];if(rd&&!plan.some(i=>i.k==='release'))list.push({k:'release',target:rd,val:prim||G.weeks-G.week<=3?40:12,why:prim?'The primary is now. Use what you have.':G.weeks-G.week<=3?'It’s October. Perfect timing to drop it.':'You could release now, or hold it for October when it hurts more.'});
  return list.sort((x,y)=>y.val-x.val);
}
function recLabel(r){if(r.k==='endorse')return 'Court '+ENDORSERS.find(e=>e.id===r.id).n;if(r.k==='oppo')return 'Dig for dirt on '+G.cands[r.target].name;if(r.k==='release')return 'Release the dirt on '+G.cands[r.target].name;return r.a?ACTIONS[r.k].n+' in '+ST[r.a].n:ACTIONS[r.k].n;}
function addRec(r){const ex={};if(r.id)ex.id=r.id;if(r.target){ex.target=r.target;ex.method=r.method||'clean';}addPlan(r.k,r.a||null,ex);}
function margeTop(n){
  const out=[];const seen=new Set();
  for(const r of margeCandidates(G.plan)){const key=r.k+(r.a||'')+(r.id||'')+(r.target||'');if(seen.has(key))continue;
    if(!actionAvail(r.k))continue;
    if(!['rally','ad','attack','ground','petition','fund'].includes(r.k)&&G.plan.some(p=>p.k===r.k))continue;
    seen.add(key);out.push(r);if(out.length>=n)break;}
  return out;
}
function margePlanWeek(){
  let guard=0;
  while(apLeft()>0&&guard++<12){
    const cands=margeCandidates(G.plan).filter(r=>{
      if(!actionAvail(r.k))return false;
      if(r.k==='petition')return canTarget('petition',r.a);
      if(['interview','poll','endorse','oppo','release','prep','bury','confess'].includes(r.k))return !planned(r.k);
      return true;});
    if(!cands.length)break;const roll=rnd();const r=cands[Math.min(cands.length-1,roll<.4?0:roll<.65?1:roll<.85?2:3)];
    const before=G.plan.length;addRec(r);
    if(G.plan.length===before){if(!planned('fund'))G.plan.push({k:'fund',a:null});else break;}
  }
  UI.pending=null;UI.flash='';
}
function margeAdvice(){
  const top=margeTop(1)[0];
  let situation;
  if(isPrimary()){const nat=pNational(G.pPolls);const lead=G.primaryField.slice().sort((a,b)=>nat[b]-nat[a]);
    situation=lead[0]==='P'?`You lead the primary at ${pct(nat.P)}%. Keep the pressure on.`:`${G.cands[lead[0]].name} leads at ${pct(nat[lead[0]])}%. You’re at ${pct(nat.P)}%.`;}
  else{const ev=dispSum().ev.P;situation=ev>=270?`You’re projected at ${ev} electoral votes. Don’t get comfortable.`:`You’re projected at ${ev} electoral votes. You need ${270-ev} more.`;}
  return {situation,top};
}

/* ================= Week flow ================= */
function weekStart(){
  const c=P();G.plan=[];G.notes=[];UI.mq=[];
  G.apWeek=STAFF[G.staff].ap+(c.perk==='stamina'&&((isPrimary()?G.round:G.week)%2===0)?1:0)+(c.flaw==='workaholic'?1:0);
  if(c.flaw==='thin'&&rnd()<.25){G.apWeek--;tick(`${c.name} spends an afternoon arguing with an anonymous account called @bagelfacts1987`);G.notes.push('You lost an action arguing online (thin skin).');}
  G.intern=pick(INTERN);
  const q=[];
  if(G.scandalPending){G.scandalPending=false;q.push({type:'scandal'});}
  // opponent scandals
  opponents().forEach(id=>{const o=G.cands[id];if(!isHumanId(id)&&!o.scandaled&&rnd()<(isPrimary()?.04:.035)){o.scandaled=true;o.mom=clamp(o.mom-4,-10,10);o.cred=clamp(o.cred-6,0,100);tick(`SCANDAL: ${o.name}. ${o.secret}`);(G.news=G.news||[]).push({kind:'scandal',text:`Scandal: ${o.name}. ${o.secret}.`});
    q.push({type:'note',title:`Scandal hits ${o.name}`,html:`<p>${esc(o.secret)}. It’s everywhere.</p><div class="fx"><span class="up">${esc(o.name)} momentum −4</span><span class="up">${esc(o.name)} credibility −6</span></div>`});}});
  // donor strings due
  G.strings.filter(x=>!x.done&&x.due<=(G.turn||0)).forEach(x=>{x.done=true;q.push({type:'string',str:x});});
  // VP baggage
  if(!isPrimary()&&c.vp&&c.vp.baggage&&!c.vp.surfaced&&G.week>=3&&rnd()<.35){c.vp.surfaced=true;q.push({type:'event',ev:{id:'vpbag',t:`Your running mate’s past surfaces`,x:`Reporters discovered that ${c.vp.name}: ${c.vp.baggage.toLowerCase()}. You didn’t vet them.`,c:[
    {l:`Stand by ${c.vp.name}`,fx:{cred:-3,mom:-2},r:'You call it old news. It stays news for a week.'},
    {l:'Make them apologize on TV',fx:{mom:-1,cred:-1},r:'The apology helps. A little.'},
    {l:'Laugh it off',fx:{mom:-1,blocs:{young:2,senior:-2}},r:'Some voters find it charming. Others find it alarming.'}]},extra:{bloc:pick(BK)}});}
  if(isPrimary()&&G.debateRounds.includes(G.round))q.push(debateSetup('primary'));
  else if(!isPrimary()&&G.debateWeeks.includes(G.week))q.push(debateSetup('general'));
  else if(!isPrimary()&&G.week===G.vpDebateWeek&&c.vp)q.push(vpDebate());
  else if(!isPrimary()&&G.week===G.octWeek){const ev=drawEvent(true);if(ev)q.push({type:'event',ev,extra:{bloc:pick(BK)},tag:'October surprise'});}
  else{
    const n=rnd()<(isPrimary()?.7:.8)?(rnd()<.3?2:1):0;
    for(let k=0;k<n;k++){const ev=rnd()<.2?minorEvent():drawEvent(false);if(ev)q.push({type:'event',ev,extra:{bloc:pick(BK)}});}
  }
  // dirt ready reminder
  UI.mq=q;UI.modal=UI.mq.shift()||null;
  render();
}
function showNext(){UI.modal=UI.mq.shift()||null;render();}
function minorEvent(){
  const c=P();const pool=MINOR.filter(m=>!(G.minorAsked||[]).includes(m.k));if(!pool.length)return null;const m=pick(pool);G.minorAsked=(G.minorAsked||[]).concat([m.k]);
  const cur=(c.minor||{})[m.k];
  return {id:'minor_'+m.k,t:`A reporter asks: ${m.q}`,x:cur?`You’ve already said you’re ${cur>0?'for':'against'} this. A reporter wants to know if that still stands.`:`It’s not an issue you’ve campaigned on, but the cameras are rolling and you have to answer.`,minor:true,c:[
    {l:'Yes',fx:{minor:[m.k,1]},r:`You come out for it. ${Object.keys(m.yes).map(b=>BNAME[b]).join(' and ')} take note.`},
    {l:'No',fx:{minor:[m.k,-1]},r:`You come out against it. ${Object.keys(m.no).map(b=>BNAME[b]).join(' and ')} take note.`},
    {l:'Dodge the question',fx:{cred:-1},r:'“That’s a great question for a future administration.” Nobody is satisfied.'}]};
}
function drawEvent(october){
  const ph=isPrimary()?'primary':'gen';
  const seen=G.seenAtStart||[];
  let pool=EVENTS.filter(e=>!G.usedEvents.includes(e.id)&&(!e.p||e.p===ph)&&(!!e.october===!!october)&&(!e.req||e.req()));
  if(!pool.length)return null;
  const followUps=pool.filter(e=>e.req&&/2$/.test(e.id));if(followUps.length&&rnd()<.6)pool=followUps;
  const wts=pool.map(e=>(seen.includes(e.id)?.3:1)*(e.tone==='absurd'?.7:1));const tw=wts.reduce((x,y)=>x+y,0);let r=rnd()*tw;let e=pool[0];
  for(let i=0;i<pool.length;i++){r-=wts[i];if(r<=0){e=pool[i];break;}}
  G.usedEvents.push(e.id);
  const stored=store.get('politicaster.seen')||[];const ns=stored.filter(x=>x!==e.id).concat([e.id]);store.set('politicaster.seen',ns.length>EVENTS.length*.8?ns.slice(-Math.floor(EVENTS.length/2)):ns);
  return e;
}
function snapshot(){
  if(isPrimary()){const nat=pNational(G.pPolls);const st={};PRIMARY_ROUNDS[G.round-1].st.forEach(a=>st[a]=G.pPolls[a].P);return {nat:nat.P,st};}
  const st={};ST_LIST.forEach(s=>st[s.a]=G.polls[s.a].P);
  return {nat:G.pollSum.pop.P,ev:G.pollSum.ev.P,st,bloc:blocSupport()};
}
function executePlan(){
  const c=P();const notes=[];
  G.plan.forEach(it=>{
    const k=it.k,a=it.a;G.cash=Math.max(0,G.cash-costOf(k,a,it)+incomeOf(k));
    const e=actionEffect(k);
    if(k==='rally'||k==='spouse'){addEffort('P',a,'r',e.eff);if(k==='rally')c.mom=clamp(c.mom+.3,-10,10);
      const crowd=Math.round((1500+ST[a].ev*250+c.stats.cha*700)*(k==='spouse'?1.3:1)*(.8+rnd()*.4)/100)*100;
      notes.push(k==='spouse'?`Your celebrity spouse drew ${crowd.toLocaleString('en-US')} people in ${ST[a].n}. Several fainted.`:`Rally in ${ST[a].n}: about ${crowd.toLocaleString('en-US')} people showed up.`);
      if(k==='rally')tick(pick([`${c.name} packs a ${ST[a].n} gym; fire marshal “concerned”`,`${c.name} rallies in ${ST[a].n}, crowd chants something mostly coherent`,`${c.name} rally in ${ST[a].n} runs 40 minutes long, nobody leaves`]));
      if(k==='rally'&&rnd()<(c.flaw==='gaffe'?.18:.03)*(c.perk==='darling'?.5:1)){const g=gaffe();notes.push(g[0][0]+' (momentum '+sgn(g[0][1])+')');}}
    if(k==='ad'){addEffort('P',a,'a',e.eff);notes.push(`Ads ran across ${ST[a].n} for ${money(costOf(k,a))}.`);tick(`${c.name} ad blitz hits ${ST[a].n}; local TV stations thrilled`);}
    if(k==='attack'){const o=it.opp&&G.cands[it.opp]?it.opp:leadOppIn(a);addEffort(o,a,'a',-5);c.cred=clamp(c.cred-.5,0,100);notes.push(`Your attack ad hit ${G.cands[o].name} in ${ST[a].n}.`);tick(`${c.name} goes negative on ${G.cands[o].name} in ${ST[a].n}`);}
    if(k==='ground'){addEffort('P',a,'g',e.eff);notes.push(`New field offices open in ${ST[a].n}. That support won’t fade.`);}
    if(k==='petition'){P().ballot[a]=true;notes.push(`Volunteers got ${G.customParty.name} on the ballot in ${ST[a].n}.`);tick(`${G.customParty.name} qualifies for the ballot in ${ST[a].n}`);}
    if(k==='fund'){notes.push(`Fundraiser brought in ${money(incomeOf(k))}.`);tick(`${c.name} attends $5,000-a-plate dinner; plate reportedly “fine”`);}
    if(k==='donor'){notes.push(`Donor dinner raised ${money(incomeOf(k))}.`);tick(`${c.name} spotted at a donor dinner with three hedge funds and a yacht`);
      if(rnd()<.5){const i=Math.floor(rnd()*9);const dir=c.pos[i]>.3?-1:c.pos[i]<-.3?1:(rnd()<.5?1:-1);const donor=pick(['A hedge fund titan','A shipping magnate','A crypto billionaire','A pharmaceutical heiress','A casino owner']);
        G.strings.push({donor,i,dir,due:(G.turn||0)+2});notes.push(`${donor} wants you to move ${dir<0?'left':'right'} on ${ISSUES[i].n.toLowerCase()} within two weeks.`);}}
    if(k==='interview'){c.mom=clamp(c.mom+e.mom,-10,10);notes.push(`National interview: momentum ${sgn(e.mom)}.`);tick(`${c.name} sits down for a prime-time interview and uses several words`);
      if(rnd()<(c.flaw==='gaffe'?.25:.08)*(c.perk==='darling'?.5:1)){const g=gaffe();notes.push(g[0][0]+' (momentum '+sgn(g[0][1])+')');}}
    if(k==='speech'){const cost=speechCost(it.from,it.to);c.pos[it.i]=it.to;c.cred=clamp(c.cred-cost,0,100);const big=Math.abs(it.to-it.from)>=.4;if(big)G.flips++;
      notes.push(`Policy speech: you’re now ${posText(it.i,it.to)}. Credibility −${cost}${big?' (a full flip-flop)':' (a “clarification”)'}.`);tick(big?`${c.name} shifts sharply on ${ISSUES[it.i].n.toLowerCase()}`:`${c.name} “clarifies” position on ${ISSUES[it.i].n.toLowerCase()}`);}
    if(k==='poll')notes.push(runPoll());
    if(k==='endorse'){const en=ENDORSERS.find(x=>x.id===it.id);if(rnd()<endorseChance(en))notes.push(gainEndorser('P',en));else{notes.push(`${en.n} passed on endorsing you. For now.`);}}
    if(k==='oppo'){const o=G.cands[it.target];G.dirt[it.target]=Math.min(100,(G.dirt[it.target]||0)+(it.method==='dirty'?55:30));
      if(it.method==='dirty'&&rnd()<.2){c.cred=clamp(c.cred-5,0,100);c.mom=clamp(c.mom-2,-10,10);notes.push(`Your dirty digging on ${o.name} leaked. Credibility −5, momentum −2.`);tick(`Report: ${c.name} campaign hired private eyes to dig through ${o.name}’s trash`);}
      else notes.push(`Opposition research on ${o.name}: ${Math.round(G.dirt[it.target])}% complete.${G.dirt[it.target]>=100?' Ready to release.':''}`);}
    if(k==='release'){const o=G.cands[it.target];const oct=!isPrimary()&&G.weeks-G.week<=2;const m=oct?1.5:1;o.mom=clamp(o.mom-5*m,-10,10);o.cred=clamp(o.cred-8*m,0,100);o.scandaled=true;G.releasedOn=(G.releasedOn||[]).concat([it.target]);G.released=true;
      notes.push(`You released the dirt on ${o.name}: ${o.secret.charAt(0).toLowerCase()+o.secret.slice(1)}.${oct?' October timing made it hurt more.':''}`);tick(`BOMBSHELL: ${o.name}. ${o.secret}`);}
    if(k==='prep'){G.prep++;notes.push(`Debate prep session ${G.prep} of 3 complete.`);}
    if(k==='bury'){G.exposure=clamp(G.exposure-20,0,100);if(rnd()<.15){G.exposure=clamp(G.exposure+25,0,100);notes.push('A staffer leaked part of the cover-up. Exposure went up instead.');tick(`Former ${c.name} staffer hints at “a story” on a podcast`);}else notes.push('Lawyers buried the story a little deeper. Exposure −20.');}
    if(k==='confess'){const m=c.perk==='teflon'?.5:1;c.mom=clamp(c.mom-3*m,-10,10);c.cred=clamp(c.cred+3,0,100);G.secretState='confessed';G.confessed=true;G.exposure=0;
      tick(`${c.name} admits: ${G.secret.toLowerCase()}. Voters shrug, mostly`);notes.push('You came clean. Momentum dipped, but the secret can’t hurt you now.');}
  });
  // staff costs
  const sc=staffCost();if(G.cash>=sc){G.cash-=sc;notes.push(`Staff payroll: −${money(sc)}.`);}else{G.cash=0;if(G.staff!=='lean'){G.staff='lean';c.mom=clamp(c.mom-1,-10,10);notes.push('You couldn’t make payroll. Staff quit, and you’re down to a lean operation. Momentum −1.');tick(`${c.name} campaign misses payroll; staffers walk out`);}}
  G.plan=[];return notes;
}
function runPoll(){
  const c=P();
  if(isPrimary()){const core=PRIM_CORE[c.party];const opts=core.map((x,j)=>j).filter(j=>!G.revealed.some(r=>r.pj===j&&r.party===c.party));const j=opts.length?pick(opts):0;const [i,dir]=core[j];const thr=primThr(c.party,j);
    const txt=`${partyName(c.party)} primary voters want you at least ${Math.round(thr/2*100)}% ${dir<0?'left':'right'} on ${ISSUES[i].n.toLowerCase()}.`;G.revealed.push({party:c.party,pj:j,txt});return 'Internal poll: '+txt;}
  let best=null,bv=-1;BK.forEach(bk=>{const w=worstIssue(c.pos,bk);const val=w.gap*WEIGHT[bk][w.i];if(val>bv&&!G.revealed.some(r=>r.bk===bk&&r.i===w.i)){bv=val;best={bk,i:w.i};}});
  if(!best||bv<=0){best={bk:pick(BK)};best.i=WEIGHT[best.bk].indexOf(Math.max(...WEIGHT[best.bk]));}
  const id=idealOf(best.bk,best.i);const lo=clamp(id-TOL,-2,2),hi=clamp(id+TOL,-2,2);const f=v=>Math.round(Math.abs(v)/2*100)+'% '+(v<0?'left':v>0?'right':'');
  const txt=`${BNAME[best.bk]} are comfortable between ${f(lo)} and ${f(hi)} on ${ISSUES[best.i].n.toLowerCase()}.`;G.revealed.push({bk:best.bk,i:best.i,txt});return 'Internal poll: '+txt;
}
function gainEndorser(id,en){
  const c=G.cands[id];G.usedEndorsers.push(en.id);c.ebm=c.ebm||{};for(const k in en.fx)c.ebm[k]=(c.ebm[k]||0)+en.fx[k];refreshStatic(c);
  if(en.ground)en.ground.forEach(a=>addEffort(id,a,'g',3));if(en.state)addEffort(id,G.govState,'g',6);
  if(id==='P'){if(en.cash)G.cash+=en.cash;if(en.mom)c.mom=clamp(c.mom+en.mom,-10,10);if(en.cred)c.cred=clamp(c.cred+en.cred,0,100);}
  G.endorsed[id]=(G.endorsed[id]||[]).concat([en.id]);
  const name=en.state?`The governor of ${ST[G.govState].n}`:en.n;tick(`${name} endorses ${c.name}`);
  return `${name} endorsed ${id==='P'?'you':c.name}!`;
}
function aiTurn(){
  const prim=isPrimary();
  const mult=prim?{easy:.6,normal:.9,hard:1.15}[G.diff]:{easy:1.6,normal:1.8,hard:1.6}[G.diff];
  const ids=prim?G.primaryField:G.active;const log={},attacks=[];
  const nBase={easy:3,normal:4,hard:4}[G.diff];
  let natP=null;if(!prim&&G.pollSum)natP=G.pollSum;const TN=(typeof TUNE!=='undefined'?TUNE:{m:1,sp:null});
  const HUM=humanIds();const hv=natP?{ev:Math.max(...HUM.map(h=>natP.ev[h]||0)),pop:Math.max(...HUM.map(h=>natP.pop[h]||0))}:null;
  const TG=prim?'P':attackTarget(natP,HUM);const TC=G.cands[TG];
  ids.filter(id=>!isHumanId(id)).forEach(id=>{
    const c=G.cands[id];log[id]=[];
    // comeback mode
    let behind=false;
    if(!prim&&natP){const evGap=hv.ev-natP.ev[id];const popGap=hv.pop-natP.pop[id];behind=c.party!=='C'&&(evGap>60||popGap>.035);}
    if(behind&&!c.comeback){c.comeback=true;tick(`${c.name} shakes up campaign staff, vows to “take the gloves off”`);G.news.push({kind:'comeback',text:`${c.name} is in comeback mode: expect more attacks and aggressive campaigning.`});}
    if(!behind&&c.comeback&&natP&&natP.ev[id]>=hv.ev)c.comeback=false;
    let n=nBase+(c.comeback?1:0)+((c.perk==='stamina'||c.flaw==='workaholic')?1:0);const m=mult*(prim?1:TN.m)*(c.comeback?1.15:1);
    const attacksWanted=prim?(rnd()<.5?1:0):(c.comeback?2:rnd()<{easy:.4,normal:.8,hard:.95}[G.diff]?1:0);
    if(!prim&&c.mom<{easy:1.5,normal:3.5,hard:3.5}[G.diff]){n--;c.mom=clamp(c.mom+1.4+(c.stats.cha-3)*.4,-10,10);log[id].push && 0;tick(`${c.name} does a round of prime-time interviews`);}
    for(let k=0;k<n;k++){
      if(k<attacksWanted){
        const opts=(prim?PRIMARY_ROUNDS[G.round-1].st:ST_LIST.filter(s=>onBallot(TC,s.a)).map(s=>s.a)).map(a=>{const sh=prim?pShares(a):shares(a);const others=Object.entries(sh).filter(([q])=>q!==TG).map(([,v])=>v);const best=Math.max(...others);return {a,v:ST[a].ev*Math.exp(-Math.abs(sh[TG]-best)/.05)*(sh[TG]>.1?1:.1)};}).sort((x,y)=>y.v-x.v);
        if(opts.length){const t=opts[0];const before=prim?pShares(t.a)[TG]:shares(t.a)[TG];addEffort(TG,t.a,'a',-4.5*m);const after=prim?pShares(t.a)[TG]:shares(t.a)[TG];
          attacks.push({id,a:t.a,d:after-before,tgt:TG});tick(`${c.name} attack ad slams ${TC.name} in ${ST[t.a].n}`);continue;}}
      // plan like Marge: maximize marginal electoral value under saturation
      const opts=(prim?PRIMARY_ROUNDS[G.round-1].st.map(a=>ST[a]):ST_LIST.filter(s=>onBallot(c,s.a))).map(s=>{
        const sh=prim?pShares(s.a):shares(s.a);const mine=sh[id];const best=Math.max(...Object.entries(sh).filter(([q])=>q!==id).map(([,v])=>v));
        const raw=Math.max(0,eff(id,s.a));const cap=8+s.ev*.5;const marg=Math.exp(-raw/cap);
        const w=prim?s.ev*10:s.ev*Math.exp(-Math.abs(mine-best)/.05);
        return {a:s.a,v:w*mine*(1-mine)*marg+.0001};}).sort((x,y)=>y.v-x.v);
      const top=opts.slice(0,TN.sp||{easy:2,normal:1,hard:1}[G.diff]);const t=top[Math.floor(rnd()*top.length)];
      addEffort(id,t.a,rnd()<.5?'r':'a',(rnd()<.5?5:6)*m);if(!log[id].includes(t.a))log[id].push(t.a);
    }
    // AI digs on you
    if(!prim&&!G.humans&&G.secretState==='hidden')G.exposure=clamp(G.exposure+(c.comeback?3:0),0,100);
    c.mom=clamp(c.mom+gauss()*.8+(c.comeback?.6:0),-10,10);
    if(c.flaw==='gaffe'&&rnd()<.12){c.mom=clamp(c.mom-2,-10,10);tick(`${c.name} gaffe: calls ${pick(ST_LIST).n} “a lovely little province”`);}
    if(rnd()<.35)tick(`${c.name}: “${pick(c.quotes)}”`);
    if(!prim&&rnd()<.12){const avail=ENDORSERS.filter(e=>!G.usedEndorsers.includes(e.id)&&(!e.req||e.req.cred!==undefined||(e.req.min!==undefined?c.pos[e.req.i]>=e.req.min:c.pos[e.req.i]<=e.req.max)));if(avail.length){log[id].endorse=gainEndorser(id,pick(avail));G.news.push({kind:'endorse',text:log[id].endorse});}}
  });
  return {log,attacks};
}
function isHumanId(id){return id==='P'||(G.humans||[]).includes(id);}
function humanIds(){return G.humans?G.humans.map(h=>G._active===h?'P':h):['P'];}
function attackTarget(natP,HUM){if(HUM.length===1||!natP)return HUM[0];return HUM.slice().sort((a,b)=>(natP.ev[b]||0)-(natP.ev[a]||0))[0];}
function decayAll(){
  for(const id in G.effort)for(const a in G.effort[id]){const e=G.effort[id][a];e.r*=.7;e.a*=.75;e.x=(e.x||0)*.7;}
  G.active.concat(G.primaryField||[]).forEach(id=>{const k=G.cands[id];k.mom*=.85;for(const b in k.bm)k.bm[b]*=.95;});
}
function endWeek(){
  UI.pending=null;UI.flash='';SFX.play('gavel');
  const before=snapshot();
  const notes=G.notes.concat(executePlan());
  const ai=aiTurn();
  decayAll();G.turn=(G.turn||0)+1;
  const c=P();
  G.mood=(G.mood||0)*.85+gauss()*.6;ST_LIST.forEach(st=>{G.drift[st.a]=(G.drift[st.a]||0)*.9+gauss()*.7;});
  if(c.flaw==='workaholic'){if(G.secretState==='hidden')G.exposure=clamp(G.exposure+3,0,100);if(rnd()<.08){c.mom=clamp(c.mom-2,-10,10);notes.push('You burned out and slept through a rally. Momentum −2.');}}
  if(G.pollSum&&!isPrimary()){const top=Object.entries(G.pollSum.pop).filter(([id])=>id!=='P').sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]-G.pollSum.pop.P>.04){const b={easy:1.2,normal:.9,hard:.6}[G.diff];c.mom=clamp(c.mom+b,-10,10);notes.push(`Underdog energy: volunteers rally to your campaign. Momentum +${b}.`);}}
  if(c.perk==='comeback'&&G.pollSum&&!isPrimary()){const top=Object.entries(G.pollSum.pop).sort((a,b)=>b[1]-a[1])[0][0];if(top!=='P'){c.mom=clamp(c.mom+1.2,-10,10);notes.push('Comeback kid: trailing fires you up. Momentum +1.2.');}}
  if(G.secretState==='hidden'){
    let lead=0;if(!isPrimary()&&G.pollSum){const top=Object.entries(G.pollSum.pop).sort((a,b)=>b[1]-a[1])[0][0];lead=top==='P'?3:0;}
    const oppDig={easy:1,normal:3,hard:5}[G.diff]*(isPrimary()?.5:1);
    const inc=(3+lead+{easy:0,normal:1,hard:3}[G.diff]+oppDig)*(c.perk==='teflon'?.6:1);G.exposure=clamp(G.exposure+inc,0,100);
    if(G.exposure>=100)G.scandalPending=true;
    else if(G.exposure>=75)notes.push(`Warning: your secret is at ${Math.round(G.exposure)}% exposure. Your opponents are digging too.`);
  }
  if(isPrimary()){resolvePrimaryRound(notes,ai);return;}
  G.prevPolls=G.polls;computePolls();G.pollHistory.push({w:G.week,sh:{...G.pollSum.pop},ev:{...G.pollSum.ev}});
  const after=snapshot();
  const lead=Object.entries(G.pollSum.pop).sort((a,b)=>b[1]-a[1]);
  tick(`New national poll: ${G.cands[lead[0][0]].name} ${pct(lead[0][1])}%, ${G.cands[lead[1][0]].name} ${pct(lead[1][1])}%`);
  if(c.party==='C'&&G.week===G.ballotDeadline){const n=Object.keys(P().ballot||{}).length;notes.push(`The ballot deadline has passed. You’re on the ballot in ${n} states.`);}
  const recap=buildRecap(before,after,notes,ai);recap.news=(G.news||[]).slice();G.news=[];recap.mood=G.mood;G.prevBloc=after.bloc;
  G.week++;
  if(G.week>G.weeks){G.trailedFinal=lead[0][0]!=='P';UI.modal={type:'recap',recap,then:'night',title:'Final week recap'};render();return;}
  save();UI.modal={type:'recap',recap,then:'weekStart',title:`Week ${G.week-1} recap`};render();
}
function quoteFor(bk,dir){const t=FG[bk][dir];return {text:seeded(t,bk+G.week+dir)+' '+hintLine(bk),who:seeded(VOICE_NAMES[bk],bk+G.week)+' ('+BNAME[bk].toLowerCase()+')'};}
function buildRecap(before,after,notes,ai){
  const r={notes,ai:[],attacks:[]};
  r.nat=[before.nat,after.nat];r.ev=[before.ev,after.ev];
  const moves=ST_LIST.map(s=>({a:s.a,d:after.st[s.a]-before.st[s.a],now:after.st[s.a]})).filter(m=>onBallot(P(),m.a));
  r.moves=moves.slice().sort((x,y)=>Math.abs(y.d)-Math.abs(x.d)).filter(m=>Math.abs(m.d)>=.002);
  r.blocs=BK.map(b=>({b,now:after.bloc[b],d:after.bloc[b]-before.bloc[b]})).sort((x,y)=>Math.abs(y.d)-Math.abs(x.d));
  r.ai=aiTargetsText(ai);
  r.attacks=ai.attacks.map(x=>`${G.cands[x.id].name}’s attack ad in ${ST[x.a].n}: ${sgn(x.d*100)} pts for you.`);
  r.quotes=r.blocs.slice(0,2).map(x=>({...quoteFor(x.b,x.d>.003?'up':x.d<-.003?'down':'flat')}));
  const weakest=r.blocs.slice().sort((x,y)=>x.now-y.now)[0];if(!r.blocs.slice(0,2).some(x=>x.b===weakest.b))r.quotes.push(quoteFor(weakest.b,weakest.d>.003?'up':'flat'));
  return r;
}

function aiTargetsText(ai){const out=[];const log=ai.log||ai;for(const id in log){if(log[id].length)out.push(`${G.cands[id].name} campaigned in ${log[id].map(a=>ST[a].n).join(', ')}.`);if(log[id].endorse)out.push(log[id].endorse);}return out;}
/* ================= Primaries ================= */
function resolvePrimaryRound(notes,ai){
  const r=PRIMARY_ROUNDS[G.round-1];const rows=[];const roundDel={};G.primaryField.forEach(id=>roundDel[id]=0);
  r.st.forEach(a=>{let sh=pShares(a);for(const id in sh)sh[id]=Math.max(.001,sh[id]+gauss()*.02);const t=Object.values(sh).reduce((x,y)=>x+y,0);for(const id in sh)sh[id]/=t;
    const del=ST[a].ev*10;const elig=Object.entries(sh).filter(([,v])=>v>=.15);const et=elig.reduce((x,[,v])=>x+v,0);
    elig.forEach(([id,v])=>{const d=Math.round(del*v/et);G.delegates[id]+=d;roundDel[id]+=d;});
    const win=Object.entries(sh).sort((x,y)=>y[1]-x[1])[0][0];G.pResults=G.pResults||{};G.pResults[a]=win;rows.push({a,sh,win});});
  const roundWin=Object.entries(roundDel).sort((x,y)=>y[1]-x[1])[0][0];
  G.cands[roundWin].mom=clamp(G.cands[roundWin].mom+4,-10,10);
  if(G.round===1&&roundWin!=='P')G.lostRound1=true;
  tick(`${G.cands[roundWin].name} wins ${r.n}`);
  const field=G.primaryField.slice();const drops=[];
  if(G.round<G.rounds){
    const rivals=G.primaryField.filter(i=>i!=='P').sort((a,b)=>G.delegates[a]-G.delegates[b]);
    const maxD=Math.max(...G.primaryField.map(i=>G.delegates[i]));
    rivals.forEach((id,idx)=>{if(G.primaryField.length-drops.length<=2)return;if(idx===0&&rivals.length>=3||G.delegates[id]<maxD*.2&&G.round>=2)drops.push(id);});
    drops.forEach(id=>{const rest=G.primaryField.filter(x=>x!==id&&!drops.includes(x));const c=G.cands[id];
      const to=rest.sort((x,y)=>{const d=q=>G.cands[q].pos.reduce((s,v,i)=>s+Math.abs(v-c.pos[i]),0);return d(x)-d(y);})[0];
      G.cands[to].mom=clamp(G.cands[to].mom+2,-10,10);G.cands[to].bm.prog=(G.cands[to].bm.prog||0);
      G.dropped.push({id,to});tick(`${c.name} drops out and endorses ${G.cands[to].name}`);});
    G.primaryField=G.primaryField.filter(x=>!drops.includes(x));G.active=G.primaryField.slice();
  }
  UI.modal={type:'primaryResults',rows,field,round:G.round,roundWin,roundDel,notes,ai:aiTargetsText(ai).concat(ai.attacks.map(x=>`${G.cands[x.id].name}’s attack ad in ${ST[x.a].n}: ${sgn(x.d*100)} pts for you.`)),drops:drops.map(id=>({id,to:G.dropped.find(d=>d.id===id).to}))};render();
}
function afterPrimaryResults(){
  if(G.round<G.rounds){G.round++;pPolls();save();weekStart();return;}
  const nom=Object.entries(G.delegates).filter(([id])=>G.primaryField.includes(id)||id==='P').sort((x,y)=>y[1]-x[1])[0][0];
  if(nom!=='P'){finish({lostNomination:true,nominee:nom});return;}
  const second=G.primaryField.filter(i=>i!=='P').sort((a,b)=>G.delegates[b]-G.delegates[a])[0];
  G.unity=second&&G.delegates[second]>G.delegates.P*.6?-3:0;
  G.primaryField.filter(i=>i!=='P').forEach(i=>tick(`${G.cands[i].name} concedes and endorses ${P().name}`));
  BK.forEach(b=>{P().bm[b]=(P().bm[b]||0)+1;});
  beginGeneral();
}
/* ================= Debates ================= */
function debateSetup(kind){
  if(kind==='general'&&P().party==='C'){const nat=G.pollSum.pop.P;
    if(nat<.15){tick(`${P().name} misses the debate stage at ${pct(nat)}% in the polls`);return {type:'note',title:'You didn’t make the debate stage',html:`<p>You need 15% in national polling to be invited. You’re at ${pct(nat)}%. The other candidates debate without you tonight.</p><p class="muted">Raise your national number with momentum: interviews, endorsements, good event choices, and strong showings in your base states.</p>`};}}
  const nq=G.pace==='quick'?4:5;
  let pool=DQ.filter(q=>!q.req||q.req());
  const fresh=pool.filter(q=>!(G.usedQ||[]).includes(q.t));if(fresh.length>=nq)pool=fresh;
  let qs=shuffle(pool).slice(0,nq);
  const rec=(G.recentEv||[]).filter(r=>(G.turn||0)-r.turn<=3);
  if(rec.length){const r=pick(rec);qs[0]={type:'recent',t:`Recently: “${r.t}” You chose to ${r.choice.charAt(0).toLowerCase()+r.choice.slice(1)}. Was that the right call?`,a:[['message','I’d make the same call again. Here’s why it was right for the country.'],['policy','Looking back, here’s what I’d do even better, in three specific steps.'],['attack','At least I made a decision. {opp} still hasn’t said what they’d do.'],['joke','In hindsight, I should have asked Tanner the intern. Actually, no.']]};}
  if(rnd()<.6){const m=pick(MINOR);qs[qs.length-1]={type:'minorq',minor:m.k,t:m.q};}
  G.usedQ=(G.usedQ||[]).concat(qs.map(q=>q.t));
  qs=qs.map(q=>({...q,answers:buildAnswers(q)}));
  return {type:'debate',kind,qs,i:0,score:0,stage:'ask',zinger:true};
}
function buildAnswers(q){
  const c=P();
  if(q.type==='minorq'){const m=MINOR_BY[q.minor];const cur=(c.minor||{})[q.minor];
    return [{style:'policy',text:`Yes. ${m.n} is the right call.`,minor:[q.minor,1],flipm:cur===-1},{style:'policy',text:`No. ${m.n} is the wrong call.`,minor:[q.minor,-1],flipm:cur===1},{style:'joke',text:`I’ll answer that right after I finish this sandwich. Or is it a hot dog?`},{style:'message',text:'Let’s focus on the issues that matter most to your family.'}];}
  if(q.a)return shuffle(q.a.map(([style,text])=>({style,text})));
  const i=q.issue,v=c.pos[i];const side=v<=-.5?'L':v>=.5?'R':'C';const lines=rnd()<.5?ISSUE_LINES:ISSUE_LINES_ALT;
  const out=[{style:'policy',text:lines[i][side]}];
  if(Math.abs(v)>=.5)out.push({style:'pivot',text:(rnd()<.5?ISSUE_LINES:ISSUE_LINES_ALT)[i].C,flip:[i,-Math.sign(v)]});
  out.push({style:'attack',text:ATTACK_LINES[i]});
  if(JOKE_LINES[i])out.push({style:'joke',text:JOKE_LINES[i]});
  else out.push({style:'message',text:'This is too serious for zingers. I’ll tell you exactly where I stand, and I won’t change it to win a debate.'});
  return out;
}
function debP(style,qtype){
  const c=P();let p=.47+(c.stats.deb-3)*.07+G.prep*.07+((FIT[qtype]||FIT.policy)[style]||0)+{easy:.08,normal:0,hard:-.08}[G.diff]+(c.stats.comp-3)*.02;
  if(c.flaw==='fuse'&&style==='attack')p+=.05;if(c.perk==='shark')p+=.07;if(c.flaw==='lightweight'&&(style==='policy'||style==='pivot'))p-=.1;const opp=mainOpp();if(opp&&!isPrimary())p-=(G.cands[opp].stats.deb-3)*.03;return clamp(p,.1,.92);
}
function hintFor(p){if(p>=.65)return ['strong','Strong fit'];if(p>=.52)return ['solid','Solid'];if(p>=.4)return ['risky','Risky'];return ['long','Long shot'];}
function answerDebate(idx){
  const m=UI.modal,q=m.qs[m.i],ans=q.answers[idx],c=P();
  const p=debP(ans.style,q.type==='minorq'?'policy':q.type);const ok=rnd()<p;
  let pts=ok?(ans.style==='joke'?1.5:1):(ans.style==='joke'?-1.5:-1);
  let extra='';
  if(!ok&&c.flaw==='fuse'&&(ans.style==='attack'||q.type==='attack')){pts-=.5;extra=' You visibly bristle on camera.';}
  if(ans.flip){const list=[];shiftIssue(ans.flip[0],ans.flip[1],.5,list);extra+=' '+list.map(l=>l[0]).join('. ')+'.';}
  if(ans.minor){const list=applyFx({minor:ans.minor});extra+=' '+list.map(l=>l[0]).join('. ')+'.';}
  if(c.flaw==='overconfident')pts*=1.5;
  m.score+=pts;
  const opp=mainOpp();m.rebuttal=opp?`${G.cands[opp].name}: “${rnd()<.4?pick(G.cands[opp].quotes):pick(REBUTTALS)}”`:null;
  SFX.play(ok?'applause':'gasp');
  m.answered={ok,txt:fill(STYLE_OUT[ans.style][ok?0:1])+extra,pts,quote:fill(ans.text)};m.stage=m.rebuttal?'answered':'done1';render();
}
function rebutDebate(k){
  const m=UI.modal;let ok,pts,txt;const c=P();
  if(k==='counter'){const p=debP('attack','attack')-.05;ok=rnd()<p;pts=ok?1:-1;txt=ok?'You turn it right back around. The crowd reacts.':'Your counter falls flat. You’re now arguing about the wrong thing.';if(!ok&&c.flaw==='fuse'){pts-=.5;txt+=' You lose your cool for a moment.';}}
  else if(k==='zinger'){m.zinger=false;const p=clamp(.4+G.prep*.08+(c.stats.cha-3)*.05,.15,.85);ok=rnd()<p;pts=ok?2:-1.5;txt=ok?`You cut in: “${fill(pick(ZINGERS))}” The room explodes. That’s the clip of the night.`:`You cut in with a zinger. The moderator scolds you, and nobody laughs.`;}
  else{ok=true;pts=-.25;txt='You let it slide and stay above the fray. It costs you a little.';}
  if(c.flaw==='overconfident')pts*=1.5;
  SFX.play(ok?(k==='zinger'?'bigapplause':'applause'):(k==='slide'?'gavel':'boo'));
  m.score+=pts;m.rebutRes={ok,txt};m.stage='rebutted';render();
}
function nextDebate(){
  const m=UI.modal;m.answered=null;m.rebutRes=null;m.stage='ask';m.i++;
  if(m.i>=m.qs.length){
    const c=P();const s=m.score;let res;
    const oc=mainOpp()?G.cands[mainOpp()]:null;
    if(s>=1.5){res='won';c.mom=clamp(c.mom+4,-10,10);c.cred=clamp(c.cred+2,0,100);if(oc)oc.mom=clamp(oc.mom-2,-10,10);}
    else if(s<=-1.5){res='lost';c.mom=clamp(c.mom-3*dmult(true),-10,10);if(oc)oc.mom=clamp(oc.mom+3,-10,10);}
    else res='draw';
    if(m.kind==='general'){G.debates.total++;G.debates[res==='won'?'won':res==='lost'?'lost':'draw']++;}
    G.prep=0;
    tick(res==='won'?`Instant poll: ${c.name} wins the debate`:res==='lost'?`Instant poll: ${c.name} struggles on the debate stage`:'Instant poll: debate called a draw');
    m.done=res;
  }
  render();
}
function vpDebate(){
  const c=P();const vp=c.vp;const opp=G.cands[mainOpp()];const q={swing:[.6,.25],star:[.5,.6],general:[.6,.15],ceo:[.4,.3]}[vp.type]||[.5,.3];
  const roll=q[0]+(rnd()-.5)*2*q[1];let res,fx;
  if(roll>.62){res='won';fx={mom:2};}else if(roll<.38){res='lost';fx={mom:-2};}else{res='draw';fx={};}
  const list=applyFx(fx,{});
  const lines={won:`${vp.name} dominates the vice presidential debate and leaves ${opp.vp?opp.vp.name:'the other running mate'} stammering about tax brackets.`,lost:`${vp.name} freezes when asked to name a single bill. Twice.`,draw:`Both running mates are fine. Viewers mostly remember a fly that landed on a moderator.`};
  tick(res==='won'?`${vp.name} wins the VP debate`:res==='lost'?`${vp.name} stumbles in the VP debate`:'VP debate ends in a sleepy draw');
  return {type:'note',title:'The vice presidential debate',html:`<p>${esc(lines[res])}</p>${fxHTML(list)}`};
}
function stringChoice(k){
  const x=UI.modal.str;const list=[];
  if(k==='comply'){shiftIssue(x.i,x.dir,.5,list);tick(`${P().name} quietly shifts on ${ISSUES[x.i].n.toLowerCase()}`);}
  else{G.donorBlock=(G.turn||0)+3;list.push(['Donor dinners unavailable for 3 weeks',0,'info']);
    if(G.secretState==='hidden'){G.exposure=clamp(G.exposure+10,0,100);list.push(['Secret exposure',10,'bad']);}else{P().mom=clamp(P().mom-1,-10,10);list.push(['Momentum',-1]);}
    tick(`${x.donor} cuts off ${P().name}: “I don’t fund ingrates”`);}
  UI.modal={type:'note',title:k==='comply'?'You gave the donor what they wanted':'You told the donor no',html:fxHTML(list)};render();
}
/* ================= Scandal ================= */
function scandalChoice(k){
  SFX.play('gasp');const c=P();const m=c.perk==='teflon'?.5:1;let fx,r;G.scandals++;G.secretState='exposed';G.exposure=100;
  if(k==='apologize'){fx={cred:-8*m,mom:-4*m};r='You hold a press conference and own it. It hurts, but the story has nowhere left to go.';}
  else if(k==='deny'){if(rnd()<.5){fx={cred:-2*m};r='Somehow, it works. The story fizzles after three days.';}else{fx={cred:-16*m,mom:-6*m};r='The receipts come out. The denial becomes the bigger story.';}}
  else{fx={cred:-6*m,mom:-2*m,blocs:{rural:2}};r='Your base rallies around you. Everyone else rolls their eyes.';}
  const list=applyFx(fx,{});tick(`${c.name} scandal: ${G.secret.toLowerCase()}`);
  UI.modal={type:'note',title:'Scandal fallout',html:`<p>${esc(r)}</p>${fxHTML(list)}`};render();
}

/* ================= Election night ================= */
function startNight(){
  G.phase='night';clearSlot(UI.slot||0);
  const final=G.mpFinal&&G.final?G.final:project(1.5,1.5);const sum=G.mpFinal&&G.finalSum?G.finalSum:summarize(final);G.final=final;G.finalSum=sum;
  const st={};ST_LIST.forEach(s=>{const lead=sum.lead[s.a];st[s.a]={closed:false,rep:0,called:null,bias:(rnd()*2-1)*.05,speed:.06+rnd()*.08-(s.ev>25?.02:0),recount:false};});
  UI.night={step:0,st,feed:[pick(ANCHOR.open)],done:false,speech:null};UI.screen='night';UI.modal=null;Music.play('night');render();
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T=reduce?120:650;
  const loop=()=>{if(UI.screen!=='night'||UI.night.done)return;nightStep();render();if(!UI.night.done)setTimeout(loop,T);};
  setTimeout(loop,reduce?100:1200);
}
function nightStyle(a){const x=UI.night.st[a];if(x.called)return {fill:`color-mix(in srgb, ${colorOf(x.called)} 85%, var(--tile))`,cls:' light'};if(x.closed&&x.rep>0){const d=nightShares(a);const lead=Object.keys(d).sort((p,q)=>d[q]-d[p])[0];return {fill:`color-mix(in srgb, ${colorOf(lead)} 30%, var(--tile))`,cls:''};}return {fill:'',cls:''};}
function nightName(id){return G.cands[id].name;}
function nightStep(){
  const n=UI.night;const step=n.step;const add=t=>{n.feed.unshift(t);n.feed=n.feed.slice(0,8);};
  CLOSE_TIMES.forEach(([t,list])=>{if(t===step){list.forEach(a=>n.st[a].closed=true);const names=list.filter(a=>BATTLEGROUND.includes(a)).map(a=>ST[a].n);
    add(pick(ANCHOR.close).replace('{states}',names.length?names.join(', ')+' and '+(list.length-names.length)+' more states':list.length+' states'));}});
  ST_LIST.forEach(s=>{const x=n.st[s.a];if(!x.closed||x.called)return;
    const lead=G.finalSum.lead[s.a];
    if(x.rep===0&&lead.margin>=.15){x.called=lead.id;if(lead.id==='P'&&BATTLEGROUND.includes(s.a))SFX.play('ding');add(pick(ANCHOR.call).replace('{name}',nightName(lead.id)).replace('{state}',s.n));x.rep=.01;return;}
    x.rep=Math.min(1,x.rep+x.speed*(.6+rnd()*.8));
    const d=nightShares(s.a);const ids=Object.keys(d).sort((a,b)=>d[b]-d[a]);const m=d[ids[0]]-d[ids[1]];
    if(x.recount){x.recountT=(x.recountT||0)+1;if(x.recountT>=3){x.called=lead.id;add(pick(ANCHOR.recountdone).replace('{name}',nightName(lead.id)).replace('{state}',s.n));}return;}
    if(x.rep>=1){if(lead.margin<.0025){x.recount=true;G.recounted=true;add(pick(ANCHOR.recount).replace('{state}',s.n));}else{x.called=lead.id;add(pick(BATTLEGROUND.includes(s.a)?ANCHOR.closecall:ANCHOR.call).replace('{name}',nightName(lead.id)).replace('{state}',s.n));}return;}
    if(x.rep>=.25&&m>.035+.12*(1-x.rep)&&ids[0]===lead.id){x.called=lead.id;if(lead.id==='P')SFX.play('ding');add(pick(BATTLEGROUND.includes(s.a)?ANCHOR.closecall:ANCHOR.call).replace('{name}',nightName(lead.id)).replace('{state}',s.n));}
    else if(BATTLEGROUND.includes(s.a)&&rnd()<.05)add(pick(ANCHOR.toss).replace('{state}',s.n));
  });
  if(step===16&&ST_LIST.some(s=>!n.st[s.a].called))add(pick(ANCHOR.late));
  n.step++;
  if(ST_LIST.every(s=>n.st[s.a].called)){n.done=true;const d=decideWinner();SFX.play(d.winner==='P'?'bigapplause':'gasp');add(d.house?'No candidate has 270. This election is going to the House of Representatives.':`BSN projects ${fullName(G.cands[d.winner])} will be the next president of the United States.`);Music.play(d.winner==='P'?'victory':'defeat');}
}
function nightShares(a){const x=UI.night.st[a];const fin=G.final[a];const o={};const w=1-x.rep;let t=0;for(const id in fin){o[id]=Math.max(.001,fin[id]+(id==='P'?x.bias:-x.bias/(Object.keys(fin).length-1))*w);t+=o[id];}for(const id in o)o[id]/=t;return o;}
function nightClock(step){const mins=19*60+step*15;const h=Math.floor(mins/60)%24,m=mins%60;const hh=h%12||12;return `${hh}:${String(m).padStart(2,'0')} ${h>=12&&h<24?'PM':'AM'} ET`;}
function nightTotals(){const t={};G.active.forEach(id=>t[id]=0);for(const a in UI.night.st){const c=UI.night.st[a].called;if(c)t[c]+=ST[a].ev;}return t;}
function decideWinner(){
  const ev=G.finalSum.ev;const top=Object.entries(ev).sort((a,b)=>b[1]-a[1]);
  if(top[0][1]>=270)return {winner:top[0][0],house:false};
  const majors=G.active.filter(id=>G.cands[id].party!=='C');
  const statesWon={};majors.forEach(id=>statesWon[id]=0);for(const a in G.finalSum.lead){const id=G.finalSum.lead[a].id;if(a!=='DC'&&statesWon[id]!==undefined)statesWon[id]++;}
  const w=majors.slice().sort((a,b)=>statesWon[b]-statesWon[a]||ev[b]-ev[a])[0];
  return {winner:w,house:true};
}

/* ================= Finish ================= */
function finish(opts){
  opts=opts||{};const got=[];const c=P();let res;
  if(opts.lostNomination)res={lostNomination:true,nominee:opts.nominee,won:false,ev:0,pop:0};
  else{const d=decideWinner();const ev=G.finalSum.ev;res={won:d.winner==='P',winner:d.winner,house:d.house,ev:ev.P,pop:G.finalSum.pop.P,evAll:ev,popAll:G.finalSum.pop};
    if(d.house)got.push('house');
    if(res.won){if(ev.P>=400)got.push('landslide');if(ev.P<=275&&!d.house)got.push('squeaker');if(G.trailedFinal)got.push('comeback');if(c.party==='C')got.push('upstart');
      if(G.secretState==='exposed')got.push('teflon');if(G.flips>=5)got.push('flipper');if(G.flips===0)got.push('steady');}
    if(c.party==='C'){if(Object.values(G.finalSum.lead).some(l=>l.id==='P'))got.push('beachhead');
      const km=ST_LIST.some(s=>{const sh=G.final[s.a];const others=Object.entries(sh).filter(([k])=>k!=='P').map(([,v])=>v).sort((a,b)=>b-a);return G.finalSum.lead[s.a].id!=='P'&&sh.P>others[0]-others[1]&&others[0]-others[1]>0;});
      if(km)got.push('kingmaker');}
    if(G.debates.total>0&&G.debates.won===G.debates.total)got.push('debater');
    if(G.lostRound1&&G.primaryField)got.push('upset');
    if(G.recounted)got.push('recount');
    if(G.speech&&!res.won&&G.speech.k==='gracious')got.push('gracious');}
  if(G.confessed)got.push('confession');
  if(G.released)got.push('dirt');
  if(G.bandit)got.push('bandit');
  res.legacy=Math.round((res.ev||0)+(res.pop||0)*400+c.cred*2+G.debates.won*25-G.flips*10+(res.won?500:0)+got.length*30+(G.speech?G.speech.legacy:0));
  const all=store.get('politicaster.ach')||{};const fresh=got.filter(g=>!all[g]);got.forEach(g=>all[g]=true);store.set('politicaster.ach',all);
  res.ach=got;res.fresh=fresh;res.title=campaignTitle(res);
  res.breakdown=[['Electoral votes',res.ev||0],['Popular vote',Math.round((res.pop||0)*400)],['Credibility',Math.round(c.cred*2)],['Debates won',G.debates.won*25],['Flip-flops',-G.flips*10],['Victory bonus',res.won?500:0],['Achievements',got.length*30],['Final speech',G.speech?G.speech.legacy:0]];
  try{const hist=store.get('politicaster.history')||[];const map={};if(G.finalSum)for(const a in G.finalSum.lead){const id=G.finalSum.lead[a].id;map[a]=id==='P'?'P':G.cands[id].party;}
    hist.unshift({date:Date.now(),name:fullName(c),party:c.party,partyName:partyName(c.party),color:c.party==='C'?G.customParty.color:null,diff:G.diff,pace:G.pace,won:res.won,lostNom:!!res.lostNomination,ev:res.ev||0,pop:res.pop||0,legacy:res.legacy,title:res.title,ach:got,map,states:Object.values(map).filter(x=>x==='P').length,
      opp:res.evAll?Object.entries(res.evAll).filter(([id])=>id!=='P').map(([id,v])=>({name:G.cands[id].name,party:G.cands[id].party,ev:v})):[],
      card:{bg:c.bg,stats:c.stats,perk:c.perk,flaw:c.flaw,bio:c.bio,pos:c.pos,minor:c.minor,home:c.home,vp:c.vp?c.vp.name:null}});
    store.set('politicaster.history',hist.slice(0,60));}catch(e){}
  G.result=res;G.phase='over';clearSlot(UI.slot||0);
  UI.screen='results';UI.modal=null;UI.tut=null;Music.play(res.won?'victory':'defeat');render();
}
function slots(){const s=store.get('politicaster.slots');return Array.isArray(s)&&s.length===5?s:[null,null,null,null,null];}
function save(){if(MP.on)return;if(!G||!(G.phase==='primary'||G.phase==='general'))return;const sl=slots();const c=P();
  sl[UI.slot||0]={meta:{name:fullName(c),party:partyName(c.party),stage:G.phase==='primary'?PRIMARY_ROUNDS[G.round-1].n:`Week ${G.week} of ${G.weeks}`,date:Date.now(),diff:G.diff},g:G};store.set('politicaster.slots',sl);}
function clearSlot(i){const sl=slots();sl[i]=null;store.set('politicaster.slots',sl);}
function pickSlot(){const sl=slots();const e=sl.findIndex(x=>!x);if(e>=0)return e;let o=0;sl.forEach((x,i)=>{if(x.meta.date<sl[o].meta.date)o=i;});return o;}
/* ================= Display helpers (polls incl. plan) ================= */
let VIEW=null;
function buildView(){
  if(isPrimary()){
    const no=pTruth(),yes=withPlan(G.plan,pTruth);const disp={};
    ST_LIST.forEach(s=>{disp[s.a]={};for(const id in no[s.a])disp[s.a][id]=clamp(G.pPolls[s.a][id]+yes[s.a][id]-no[s.a][id],.001,.999);});
    VIEW={disp,nat:pNational(disp)};return;
  }
  const no=project(0,0),yes=withPlan(G.plan,()=>project(0,0));const disp={};
  ST_LIST.forEach(s=>{disp[s.a]={};for(const id in no[s.a])disp[s.a][id]=G.polls[s.a][id]>0?clamp(G.polls[s.a][id]+yes[s.a][id]-no[s.a][id],.001,.999):0;});
  VIEW={disp,sum:summarize(disp)};
}
function dispSum(){if(!VIEW||!VIEW.sum)buildView();return VIEW.sum;}

/* ================= Tutorial ================= */
const TUT=[
 {t:'Welcome to the war room',x:'This is your campaign dashboard. Each week you plan up to four actions, then end the week to see what happened. Let’s walk through it.',sel:null},
 {t:'Your resources',x:'Cash pays for ads. Actions are how many moves you get this week. Credibility and momentum boost you everywhere. Hover any number to see exactly what it does.',sel:'.topbar'},
 {t:'The map',x:'Each tile is a state. Its color shows who leads in the polls, and darker means a bigger lead. Hover a state to see the polls and what voters there are saying about you.',sel:'.map-wrap'},
 {t:'Add a rally',x:'Click “Hold a rally” in the actions list. Rallies are free.',sel:'.act[data-v="rally"]',wait:()=>UI.pending==='rally'||G.plan.some(p=>p.k==='rally')},
 {t:'Pick a state',x:'Now click a state on the map. Gold-ringed states are Marge’s top targets. Hover any state first to preview exactly how much the rally would help.',sel:'.map-wrap',wait:()=>G.plan.some(p=>p.a)},
 {t:'Your plan',x:'Your plan shows each action and its expected effect. The map already reflects it. Click × to remove anything. Nothing is final until you end the week.',sel:'.plan-panel'},
 {t:'Ask Marge',x:'Not sure what to do? Marge suggests your best next move, opens full coaching, or plans the whole week for you.',sel:'.staff'},
 {t:'End the week',x:'Fill your remaining actions (or let Marge do it), then press End week. You’ll get a recap of what changed and why.',sel:'[data-act="endweek"]',wait:()=>G.week>1||G.round>1||UI.modal&&(UI.modal.type==='recap'||UI.modal.type==='primaryResults')},
 {t:'That’s the loop',x:'Strategy tip: focus on a handful of states that decide the race, and keep returning to them, because rallies and ads fade. The Guide button has a full glossary anytime.',sel:'[data-act="guide"]'}
];
function tutAdvance(){if(UI.tut===null)return;const s=TUT[UI.tut];if(s&&s.wait&&s.wait()){UI.tut++;if(UI.tut>=TUT.length){UI.tut=null;store.set('politicaster.tutDone',true);}}}

/* ================= Rendering ================= */
let app=null;
const SHELL={onMultiplayer:null};
function render(){
  if(!app)return;
  VIEW=null;
  if(UI.screen==='game'&&G)tutAdvance();
  let html='';
  if(UI.screen==='title')html=titleHTML();
  else if(UI.screen==='setup')html=setupHTML();
  else if(UI.screen==='game'){buildView();html=gameHTML()+(UI.tutOffer?tutOfferHTML():modalHTML())+(UI.tut!==null&&!UI.modal&&!UI.tutOffer&&!UI.guide?coachHTML():'');}
  else if(UI.screen==='night')html=nightHTML();
  else if(UI.screen==='results')html=resultsHTML();
  else if(UI.screen==='history')html=historyHTML();
  else if(UI.screen==='mpwait')html=mpWaitHTML();
  if(UI.screen==='game'&&UI.waiting)html+=mpWaitingOverlay();
  if(UI.guide)html+=guideHTML();
  app.innerHTML=html;
  if(UI.screen==='game'&&UI.tut!==null&&!UI.modal&&TUT[UI.tut].sel){const el=app.querySelector(TUT[UI.tut].sel);if(el)el.classList.add('hl');}
  if(UI.screen==='game'&&!UI.modal)save();
  if(UI.screen==='game'&&G){const t=UI.modal&&UI.modal.type;Music.play(t==='debate'?'debate':t==='event'||t==='scandal'||t==='string'?'tension':'plan');}
  const f=app.querySelector('[data-autofocus]');if(f)f.focus({preventScroll:true});
}
function titleHTML(){
  const ach=store.get('politicaster.ach')||{};const sl=slots();const fmtD=t=>new Date(t).toLocaleDateString('en-US',{month:'short',day:'numeric'});
  return `<div class="title-screen"><div class="title-card">
  <h1>Politicaster</h1><div class="sub">Road to the Presidency</div>
  <div class="chyron-strip"><div class="tag">Breaking</div><div class="txt">Polls open in 12 weeks. Somebody has to run. Might as well be you.</div></div>
  <div class="title-actions">
   <button class="btn chy" data-act="new" data-autofocus>Start a new campaign</button>
   ${SHELL.onMultiplayer?'<button class="btn primary" data-act="multiplayer">Play with friends</button>':''}
   <button class="btn" data-act="history">Campaign history</button>
   <button class="btn" data-act="guide">How to play</button>
   <button class="btn" data-act="music">${Music.on?'Music: on':'Music: off'}</button>
   <button class="btn" data-act="sfx">${SFX.on?'Sound effects: on':'Sound effects: off'}</button>
   <button class="btn" data-act="theme">Light/dark</button>
  </div>
  <h3 style="margin-top:30px;font-size:24px">Saved campaigns</h3>
  <div class="slots">${sl.map((x,i)=>x?`<div class="slot-card"><b>${esc(x.meta.name)}</b><small class="muted">${esc(x.meta.party)}. ${esc(x.meta.stage)}. ${esc(x.meta.diff)}. Saved ${fmtD(x.meta.date)}.</small><div style="display:flex;gap:6px;margin-top:6px"><button class="btn sm primary" data-act="loadslot" data-v="${i}">Continue</button><button class="btn sm" data-act="delslot" data-v="${i}">Delete</button></div></div>`:`<div class="slot-card empty"><small class="muted">Slot ${i+1}: empty</small></div>`).join('')}</div>
  ${sl.every(x=>x)?'<p class="muted" style="font-size:13px">All slots are full. A new campaign will replace your oldest save.</p>':''}
  <h3 style="margin-top:30px;font-size:24px">Achievements <span class="muted num" style="font-size:20px">${Object.keys(ach).filter(k=>ACH.some(a=>a.id===k)).length} of ${ACH.length}</span></h3>
  <div class="ach-grid">${ACH.map(a=>`<div class="ach ${ach[a.id]?'':'off'}"><b>${a.n}</b><small class="muted">${a.d}</small></div>`).join('')}</div>
  </div></div>`;
}
function historyHTML(){
  const all=store.get('politicaster.history')||[];const f=UI.hf||{party:'all',diff:'all'};
  const list=all.filter(h=>(f.party==='all'||h.party===f.party)&&(f.diff==='all'||h.diff===f.diff));
  const wins=all.filter(h=>h.won);const best=all.slice().sort((a,b)=>b.legacy-a.legacy)[0];const ls=wins.slice().sort((a,b)=>b.ev-a.ev)[0];const ms=all.slice().sort((a,b)=>b.states-a.states)[0];
  const pcol=p=>p==='P'?'var(--chyron)':p==='D'?'var(--dem)':p==='R'?'var(--rep)':'var(--muted)';
  const seg=(k,opts)=>`<div class="seg">${opts.map(([v,n])=>`<button class="${f[k]===v?'on':''}" data-act="hfilter" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
  return `<div class="wrap"><div class="brand">Politicaster</div><h1 style="font-size:48px">Campaign history</h1>
   ${all.length?`<div class="rcards" style="margin:14px 0">
    <div class="rcard"><small>Campaigns</small><span class="num">${all.length}</span><small>${wins.length} won</small></div>
    <div class="rcard"><small>Highest legacy score</small><span class="num">${best?best.legacy:'–'}</span><small>${best?esc(best.name):''}</small></div>
    <div class="rcard"><small>Biggest landslide</small><span class="num">${ls?ls.ev:'–'}</span><small>${ls?esc(ls.name):'No wins yet'}</small></div>
    <div class="rcard"><small>Most states carried</small><span class="num">${ms?ms.states:'–'}</span><small>${ms?esc(ms.name):''}</small></div></div>`:''}
   <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">${seg('party',[['all','All parties'],['D','Democratic'],['R','Republican'],['C','Own party']])}${seg('diff',[['all','All difficulties'],['easy','Easy'],['normal','Normal'],['hard','Hard']])}</div>
   ${list.length?list.map((h,i)=>{const open=UI.hx===h.date;return `<div class="panel hist">
     <button class="hist-row" data-act="hx" data-v="${h.date}" aria-expanded="${open}"><span><b>${esc(h.name)}</b> <small class="muted">${esc(h.partyName)}, ${h.diff}, ${new Date(h.date).toLocaleDateString('en-US')}</small><br><small>“${esc(h.title)}”</small></span>
      <span class="num" style="font-size:22px">${h.lostNom?'Lost primary':h.won?'Won':'Lost'} <small class="muted">${h.ev} EV</small></span><span class="num" style="font-size:22px">${h.legacy}</span></button>
     ${open?`<div class="hist-body"><div class="map-body" style="grid-template-columns:minmax(0,1fr) 260px"><div>${Object.keys(h.map).length?`<div class="tiles mini">${ST_LIST.map(s=>`<div class="tile ${h.map[s.a]?'light':''}" style="grid-row:${s.r+1};grid-column:${s.c+1};background:${h.map[s.a]?pcol(h.map[s.a]):'var(--tile)'};${h.map[s.a]==='P'?'color:var(--chyron-ink)':''}">${s.a}</div>`).join('')}</div><small class="muted">Gold: states you carried.</small>`:'<p class="muted">Didn’t reach the general election.</p>'}
       <p style="margin:8px 0 0">${h.opp.map(o=>`${esc(o.name)}: ${o.ev}`).join(' | ')}${h.opp.length?' | ':''}You: ${h.ev} (${pct(h.pop)}% of the vote)</p>
       ${h.ach.length?`<p style="margin:6px 0 0"><b>Achievements:</b> ${h.ach.map(a=>{const x=ACH.find(y=>y.id===a);return x?esc(x.n):'';}).join(', ')}</p>`:''}</div>
      <details><summary>Candidate card</summary><div style="font-size:13px;margin-top:6px">
       <p style="margin:0 0 4px"><b>${esc(BGS[h.card.bg]?BGS[h.card.bg].n:h.card.bg)}</b> from ${esc(ST[h.card.home]?ST[h.card.home].n:'')}. ${esc(bioText(h.card.bio))}</p>
       <p style="margin:0 0 4px">Charisma ${h.card.stats.cha}, Debate ${h.card.stats.deb}, Fundraising ${h.card.stats.fund}, Composure ${h.card.stats.comp}. ${esc(PERKS[h.card.perk]?PERKS[h.card.perk].n:'')}; ${esc(FLAWS[h.card.flaw]?FLAWS[h.card.flaw].n:'')}.</p>
       ${h.card.vp?`<p style="margin:0 0 4px">Running mate: ${esc(h.card.vp)}</p>`:''}
       ${ISSUES.map((is,i)=>`<div>${is.n}: ${esc(posText(i,h.card.pos[i]))}</div>`).join('')}
       ${Object.keys(h.card.minor||{}).length?`<div style="margin-top:4px">Minor: ${Object.entries(h.card.minor).filter(([,v])=>v).map(([k,v])=>(v>0?'For ':'Against ')+MINOR_BY[k].n.toLowerCase()).join('; ')}</div>`:''}</div></details></div></div>`:''}</div>`;}).join(''):'<p class="muted">No campaigns match. Finish a campaign to see it here.</p>'}
   <div class="title-actions" style="margin-top:18px"><button class="btn" data-act="title">Back to title</button>${all.length?'<button class="btn" data-act="clearhist">Clear history</button>':''}</div></div>`;
}
const STEPS=['Era','Party','Candidate','Personal','Platform','Minor issues','Rules'];
function setupHTML(){
  const S=UI.S;let body='';
  if(S.step===0){body=`<h2 style="font-size:40px">Pick your era</h2><p class="muted">Each era changes who can vote, the issues, the map, and the media. Present day is playable now; the rest are in development.</p>
   <div class="opts">${ERAS.map(e=>`<button class="opt ${S.era===e.k?'on':''}" data-act="set" data-k="era" data-v="${e.k}" ${e.k!=='present'?'disabled':''}><b>${e.n}</b><small>${e.k==='present'?'Election of '+e.y:'Election of '+e.y+' (in development)'}</small></button>`).join('')}</div>`;}
  if(S.step===1){
    body=`<h2 style="font-size:40px">Choose your party</h2>
    <div class="opts" style="margin-top:14px">
     <button class="opt ${S.party==='D'?'on':''}" data-act="party" data-v="D"><b><span class="dot" style="background:var(--dem)"></span> Democratic</b><small>Strong with urban, young, and union voters.</small></button>
     <button class="opt ${S.party==='R'?'on':''}" data-act="party" data-v="R"><b><span class="dot" style="background:var(--rep)"></span> Republican</b><small>Strong with rural, faith, and small business voters.</small></button>
     <button class="opt ${S.party==='C'?'on':''}" data-act="party" data-v="C"><b><span class="dot" style="background:${S.cp.color}"></span> Start your own party</b><small>The hard road: fight for ballot access and the debate stage. Win states, play spoiler, or pull off the upset.</small></button>
    </div>`;
    if(S.party==='C'){body+=`<div class="field"><label for="cpname">Party name</label><input id="cpname" type="text" maxlength="32" data-bind="cp.name" value="${esc(S.cp.name)}" placeholder="The Common Sense Party"></div>
     <div class="field"><span class="lab">Party color</span><div class="swatches">${CP_COLORS.map(col=>`<button class="swatch ${S.cp.color===col?'on':''}" style="background:${col}" data-act="cpcolor" data-v="${col}" aria-label="Color ${col}"></button>`).join('')}</div></div>
     <div class="field"><span class="lab">Your base: pick two voter groups (${S.cp.base.length} of 2)</span><p class="muted" style="margin:0 0 6px">Your base gives you a big head start with those groups, so you’ll be strongest in states where they’re common.</p><div class="opts">${BLOCS.map(b=>`<button class="opt ${S.cp.base.includes(b.k)?'on':''}" data-act="cpbase" data-v="${b.k}"><b>${b.n}</b></button>`).join('')}</div></div>
     <div class="field"><span class="lab">Party values</span><p class="muted" style="margin:0 0 6px">Your candidate starts here. Straying from your party’s values cools your base.</p>${sliders('cp.values',S.cp.values)}</div>`;}
  }
  if(S.step===2){
    body=`<h2 style="font-size:40px">Build your candidate</h2>
    <div class="field"><label for="cname">Name</label><input id="cname" type="text" maxlength="28" data-bind="name" value="${esc(S.name)}" placeholder="Pat Morgan"></div>
    <div class="field"><label for="home">Home state</label><select id="home" data-bind="home">${ST_LIST.filter(s=>s.a!=='DC').slice().sort((a,b)=>a.n.localeCompare(b.n)).map(s=>`<option value="${s.a}" ${S.home===s.a?'selected':''}>${s.n}</option>`).join('')}</select></div>
    <div class="field"><span class="lab">Background</span><div class="opts">${Object.entries(BGS).map(([k,b])=>`<button class="opt ${S.bg===k?'on':''}" data-act="set" data-k="bg" data-v="${k}"><b>${b.n}</b><small>${b.d}</small><small class="num">Charisma ${b.stats.cha} | Debate ${b.stats.deb} | Fundraising ${b.stats.fund} | Composure ${b.stats.comp}</small></button>`).join('')}</div>
    ${statsEditor(S)}
    <p class="muted" style="margin:8px 0 0">Charisma powers rallies. Debate improves debate odds. Fundraising sets how much each fundraiser raises. Composure steadies you under pressure.</p></div>
    <div class="field"><span class="lab">Strength</span><div class="opts">${Object.entries(PERKS).map(([k,b])=>`<button class="opt ${S.perk===k?'on':''}" data-act="set" data-k="perk" data-v="${k}"><b>${b.n}</b><small>${b.d}</small></button>`).join('')}</div></div>
    <div class="field"><span class="lab">Flaw</span><div class="opts">${Object.entries(FLAWS).map(([k,b])=>`<button class="opt ${S.flaw===k?'on':''}" data-act="set" data-k="flaw" data-v="${k}"><b>${b.n}</b><small>${b.d}</small></button>`).join('')}</div></div>
    <div class="field"><label for="secret">Skeleton in the closet</label><select id="secret" data-bind="secret"><option value="random" ${S.secret==='random'?'selected':''}>Surprise me</option>${SECRETS.map((s,i)=>`<option value="${i}" ${S.secret===String(i)?'selected':''}>${s}</option>`).join('')}<option value="none" ${S.secret==='none'?'selected':''}>Nothing to hide</option></select>
    <p class="muted" style="margin:6px 0 0">The press digs harder as you rise. Bury it, confess it, or hope for the best.</p></div>`;
  }
  if(S.step===3)body=personalHTML(S);
  if(S.step===5)body=minorHTML(S);
  if(S.step===4){body=`<h2 style="font-size:40px">Set your platform</h2><p class="muted">Every position wins some voter groups and costs you others. In primaries, your party’s base rewards conviction; in the general, the middle decides. Events test whether you stick to it, and flip-flopping costs credibility. Voter groups have hidden comfort zones on each issue that shift a little every game, so watch the feedback once you’re campaigning.</p>${sliders('pos',S.pos)}`;}
  if(S.step===6){
    body=`<h2 style="font-size:40px">Rules of the race</h2>
    <div class="field"><span class="lab">Difficulty</span><div class="opts">
     ${[['easy','Easy','Accurate polls, forgiving voters, sleepy opponents.'],['normal','Normal','Realistic polls and competent opponents.'],['hard','Hard','Noisy polls, ruthless opponents, brutal flip-flop penalties.']].map(([k,n,d])=>`<button class="opt ${S.diff===k?'on':''}" data-act="set" data-k="diff" data-v="${k}"><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
    <div class="field"><span class="lab">Pace</span><div class="opts">
     ${[['quick','Quick','About 30–60 minutes. 8-week general, one debate.'],['standard','Standard','A few hours. 12-week general, three debates, a primary debate.'],['marathon','Marathon','Multiple sessions with full calendar (in development).']].map(([k,n,d])=>`<button class="opt ${S.pace===k?'on':''}" data-act="set" data-k="pace" data-v="${k}" ${k==='marathon'?'disabled':''}><b>${n}</b><small>${d}</small></button>`).join('')}</div></div>
    ${S.party!=='C'?`<div class="field"><span class="lab">Primaries</span><div class="opts">
     <button class="opt ${S.primaries?'on':''}" data-act="set" data-k="primaries" data-v="1"><b>Run the primaries</b><small>Beat two rivals from your own party first.</small></button>
     <button class="opt ${!S.primaries?'on':''}" data-act="set" data-k="primaries" data-v="0"><b>Skip to the general</b><small>You’re already the nominee.</small></button></div></div>`:''}`;
  }
  return `<div class="wrap"><div class="brand">Politicaster</div>
   <div class="steps">${STEPS.map((s,i)=>`<span class="${i===S.step?'on':''}">${s}</span>`).join('')}</div>
   ${body}
   ${S.err?`<div class="err" role="alert">${esc(S.err)}</div>`:''}
   <div class="setup-nav"><button class="btn" data-act="back">${S.step===0?'Back to title':'Back'}</button>
   <button class="btn ${S.step===6||(MP.on&&S.step===5)?'chy':'primary'}" data-act="next">${S.step===6||(MP.on&&S.step===5)?'Announce your campaign':'Next'}</button></div></div>`;
}
function sliders(path,vals){
  return ISSUES.map((is,i)=>`<div class="slider-row"><b>${is.n}</b><div>
   <input type="range" min="-100" max="100" step="5" value="${Math.round(vals[i]*50)}" data-bind="${path}.${i}" data-scale="50" aria-label="${is.n}">
   <div class="slider-ends"><span>${is.L}</span><span>${is.R}</span></div>
   <div class="slider-val" id="lbl-${path.replace('.','-')}-${i}">${posText(i,vals[i])}</div></div></div>`).join('');
}
function statsEditor(S){const st=S.stats||BGS[S.bg].stats;const names={cha:'Charisma',deb:'Debate',fund:'Fundraising',comp:'Composure'};
  return `<div class="panel" style="margin-top:12px"><b>Fine-tune your stats</b> <small class="muted">Move points between stats. Total stays at 13; each stat runs 1 to 5.</small>
   <div class="stat-edit">${Object.keys(names).map(k=>`<div><span data-tip="${esc(STAT_TIPS[k])}" tabindex="0">${names[k]}</span><button class="btn sm" data-act="stat" data-k="${k}" data-v="-1" ${st[k]<=1?'disabled':''} aria-label="Lower ${names[k]}">−</button><b class="num" style="font-size:20px">${st[k]}</b><button class="btn sm" data-act="stat" data-k="${k}" data-v="1" ${st[k]>=5?'disabled':''} aria-label="Raise ${names[k]}">+</button></div>`).join('')}</div>
   <small class="muted">Unspent points: ${13-Object.values(st).reduce((a,b)=>a+b,0)}</small></div>`;}
function personalHTML(S){const b=S.bio;
  const sel=(key,opts,val)=>`<select data-bind="bio.${key}" data-rerender="1">${Object.entries(opts).map(([k,n])=>`<option value="${k}" ${String(val)===String(k)?'selected':''}>${esc(typeof n==='string'?n:n.n)}</option>`).join('')}</select>`;
  return `<h2 style="font-size:40px">Personal details</h2><p class="muted">These shape which voter groups warm to you and unlock their own events, debate questions, and scandals.</p>
   <button class="btn" data-act="reroll">Randomize everything</button>
   <div class="field"><label>Age: <span class="num" id="lbl-age" style="font-size:20px">${b.age}</span></label><input type="range" min="35" max="85" value="${b.age}" data-bind="bio.age" data-int="1" style="width:min(400px,100%)" aria-label="Age"><p class="muted" style="margin:4px 0 0">72 and up: seniors like you, young voters worry. 45 and under: the reverse.</p></div>
   <div class="field"><label>Relationship</label>${sel('marital',MARITAL,b.marital)}${b.marital==='celebspouse'?'<p class="muted" style="margin:4px 0 0">Unlocks “Send your celebrity spouse,” a free rally in any state.</p>':''}</div>
   <div class="field"><label>Kids</label>${sel('kids',{0:'None',1:'1',2:'2',3:'3',4:'4'},b.kids)}</div>
   <div class="field"><label>Exes</label>${sel('ex',EXES,b.ex)}</div>
   <div class="field"><label>Career before politics</label>${sel('career',CAREERS,b.career)}</div>
   <div class="field"><label>Education</label>${sel('edu',EDUS,b.edu)}</div>
   <div class="field"><span class="lab">Hobbies and quirks (pick 2)</span><div class="opts">${Object.entries(HOBBIES).map(([k,h])=>`<button class="opt ${b.hobbies.includes(k)?'on':''}" data-act="hobby" data-v="${k}"><b>${h.n}</b></button>`).join('')}</div></div>`;}
function minorHTML(S){const n=Object.keys(S.minor).length;
  return `<h2 style="font-size:40px">Minor issues</h2><p class="muted">Pick 3 to 5 smaller issues to campaign on (${n} picked). Each one wins over a few voter groups and annoys others. Reporters can still ask about the rest.</p>
   ${MINOR.map(m=>{const v=S.minor[m.k];return `<div class="slider-row"><b>${m.n}</b><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
    <button class="btn sm ${v===1?'primary':''}" data-act="minorset" data-k="${m.k}" data-v="1">For</button><button class="btn sm ${v===-1?'primary':''}" data-act="minorset" data-k="${m.k}" data-v="-1">Against</button>${v?`<button class="btn sm" data-act="minorset" data-k="${m.k}" data-v="0">Clear</button>`:''}
    <small class="muted">For: ${Object.keys(m.yes).map(b=>BNAME[b].toLowerCase()).join(', ')}. Against: ${Object.keys(m.no).map(b=>BNAME[b].toLowerCase()).join(', ')}.</small></div></div>`;}).join('')}`;}
function gameHTML(){
  const c=P();const prim=isPrimary();
  const phaseLabel=prim?`Primaries: ${PRIMARY_ROUNDS[G.round-1].n}`:`General election, week ${G.week} of ${G.weeks}`;
  const after=cashAfter();
  return `<header class="topbar">
   <div class="brand">Politicaster</div><div class="phase">${phaseLabel}</div>
   <div class="res">
    <div data-tip="${esc(TIPS.cash)}" tabindex="0" class="tip-r"><small>Cash</small><span class="num">${money(G.cash)}</span>${G.plan.length?`<span class="sub">${money(after)} after plan</span>`:''}</div>
    <div data-tip="${esc(TIPS.actions)}" tabindex="0" class="tip-r"><small>Actions planned</small><span class="num">${G.plan.length} of ${G.apWeek}</span></div>
    <div data-tip="${esc(TIPS.cred)}" tabindex="0" class="tip-r"><small>Credibility</small><span class="num">${Math.round(c.cred)}</span><span class="sub">${c.cred>=60?'helping you':'hurting you'}</span></div>
    <div data-tip="${esc(TIPS.mom)}" tabindex="0" class="tip-r"><small>Momentum</small><span class="num">${sgn(c.mom)}</span><span class="sub">fades 15%/week</span></div>
    <button class="btn" data-act="music" aria-label="Toggle music">${Music.on?'♪ On':'♪ Off'}</button>
    <input type="range" min="0" max="100" value="${Math.round(Music.vol*100)}" data-act-input="vol" aria-label="Music volume" style="width:70px">
    <button class="btn" data-act="sfx" aria-label="Toggle sound effects">${SFX.on?'🔊 On':'🔈 Off'}</button>
    <input type="range" min="0" max="100" value="${Math.round(SFX.vol*100)}" data-act-input="sfxvol" aria-label="Sound effects volume" style="width:70px">
    <button class="btn" data-act="guide">Guide</button>
    ${MP.on?`<span class="phase">Room ${esc(MP.room)}</span>`:'<button class="btn" data-act="quit">Save and quit</button>'}
   </div></header>
  <div class="grid">
   <div class="left">${leftHTML()}</div>
   <div class="center">${mapPanelHTML()}</div>
   <div class="right">${planHTML()}${actionsHTML()}${staffHTML()}</div>
  </div>
  ${tickerHTML()}`;
}
function leftHTML(){
  const c=P();const prim=isPrimary();let polls,ids;
  if(prim){polls=VIEW.nat;ids=G.primaryField;}else{polls=VIEW.sum.pop;ids=G.active;}
  const sorted=ids.slice().sort((a,b)=>polls[b]-polls[a]);
  let h=`<div class="panel"><div class="cand-head"><span class="dot" style="background:${colorOf('P')}"></span><div><h3 style="margin:0">${esc(fullName(c))}</h3>
   <small class="muted">${esc(partyName(c.party))}${c.party==='C'?'':' Party'}, ${esc(ST[c.home].n)}${c.vp?'. Running mate: '+esc(c.vp.name):''}</small></div></div>
   <small class="muted" style="display:block;margin-top:6px">${esc(bioText(c.bio))}</small>
   <div class="stats">${['cha','deb','fund','comp'].map(k=>`<span data-tip="${esc(STAT_TIPS[k])}" tabindex="0">${{cha:'Charisma',deb:'Debate',fund:'Fundraising',comp:'Composure'}[k]} <b class="num">${c.stats[k]}</b></span>`).join('')}</div>
   <small class="muted" style="display:block;margin-top:6px"><span data-tip="${esc(PERKS[c.perk].d)}" tabindex="0">${PERKS[c.perk].n}</span>. <span data-tip="${esc(FLAWS[c.flaw].d)}" tabindex="0">${FLAWS[c.flaw].n}</span>.</small></div>`;
  h+=`<div class="panel"><h3>${prim?'Primary polling':'National polling'}</h3>
   ${sorted.map(id=>`<div class="poll-row"><span class="dot" style="background:${colorOf(id)}"></span><span class="name">${esc(G.cands[id].name)}</span><span class="num">${pct(polls[id])}%</span></div>`).join('')}
   ${prim?`<small class="muted" data-tip="${esc(TIPS.delegates)}" tabindex="0">Delegates: ${G.primaryField.map(id=>esc(G.cands[id].name.split(' ').slice(-1)[0])+' '+G.delegates[id]).join(', ')} <span class="qm">?</span></small>`:spark()}
   ${G.plan.length?'<small class="muted" style="display:block;margin-top:4px">Includes the expected effect of this week’s plan.</small>':''}
  </div>`;
  h+=`<div class="panel"><h3>Opponents</h3>${opponents().map(id=>{const o=G.cands[id];const dirt=Math.round(G.dirt[id]||0);return `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b>${esc(fullName(o))}</b> <small class="muted">${esc(partyName(o.party,o))}</small>${o.comeback?' <small class="down" style="font-weight:700">Comeback mode</small>':''}<br><small class="muted">The ${esc(o.arch||'candidate')}. ${esc(o.blurb)} ${esc(bioText(o.bio))}</small><br><small>Strength: ${esc(PERKS[o.perk]?PERKS[o.perk].n:'')}. Flaw: ${esc(FLAWS[o.flaw]?FLAWS[o.flaw].n:'')}.</small>
    ${(G.endorsed[id]||[]).length?`<br><small>Endorsed by: ${G.endorsed[id].map(e=>esc(ENDORSERS.find(x=>x.id===e).n)).join(', ')}</small>`:''}
    ${dirt?`<br><small>Dirt found: ${dirt}%${dirt>=100&&!(G.releasedOn||[]).includes(id)?' (ready to release)':''}</small>`:''}${o.scandaled?'<br><small class="up">Scandal-damaged</small>':''}</div>`;}).join('')}</div>`;
  if(!prim&&G.incumbent){const md=(G.mood||0)*(G.incumbent==='D'?1:-1);h+=`<div class="panel"><h3>National mood</h3><p style="margin:0;font-size:14px">The ${G.incumbent==='D'?'Democrats':'Republicans'} hold the White House. The mood is ${md>1?'warming to them':md<-1?'souring on them':'roughly neutral'}.</p><small class="muted">Bad news (recessions, crime spikes) hurts the party in power. States also drift a little on their own each week.</small></div>`;}
  if(!prim){const bs=blocSupport();const prev=G.prevBloc||bs;
   h+=`<div class="panel"><h3>Your support by group</h3>${BLOCS.map(b=>{const d=bs[b.k]-prev[b.k];const top=WEIGHT[b.k].map((w,i)=>[w,i]).sort((x,y)=>y[0]-x[0]).slice(0,3).map(x=>ISSUES[x[1]].n.toLowerCase());
     return `<div class="bloc-row" data-tip="${esc('Cares most about: '+top.join(', ')+'. '+hintLine(b.k))}" tabindex="0"><span>${b.n}</span><span><span class="num">${pct(bs[b.k],0)}%</span>${Math.abs(d)>=.003?` <small class="${d>0?'up':'down'}">${d>0?'▲':'▼'}${pct(Math.abs(d),0)}</small>`:''}</span><div class="bar"><i style="width:${pct(bs[b.k])}%;background:${colorOf('P')}"></i></div></div>`;}).join('')}
    <small class="muted">Hover a group to see what it cares about and how close you are.</small></div>`;}
  if(G.revealed.length)h+=`<div class="panel"><h3>Inside intel</h3>${G.revealed.map(r=>`<div style="font-size:13px;padding:3px 0">${esc(r.txt)}</div>`).join('')}</div>`;
  if((G.endorsed.P||[]).length)h+=`<div class="panel"><h3>Your endorsements</h3>${G.endorsed.P.map(e=>`<div style="font-size:13px">${esc(e==='gov'?'Governor of '+ST[G.govState].n:ENDORSERS.find(x=>x.id===e).n)}</div>`).join('')}</div>`;
  if(G.secretState==='hidden'){h+=`<div class="panel exposure"><h3>Your secret</h3><p style="margin:0 0 8px;font-size:14px">${esc(G.secret)}.</p>
   <div class="bar"><i style="width:${G.exposure}%"></i></div><small class="muted" data-tip="${esc(TIPS.exposure)}" tabindex="0">Exposure ${Math.round(G.exposure)}%. At 100% it breaks. <span class="qm">?</span></small></div>`;}
  const mins=Object.entries(c.minor||{}).filter(([,v])=>v);
  h+=`<div class="panel"><h3>Platform</h3>${ISSUES.map((is,i)=>`<div style="font-size:13px;padding:3px 0"><b>${is.n}:</b> ${posText(i,c.pos[i])}</div>`).join('')}
   ${mins.length?`<div style="font-size:13px;margin-top:6px"><b>Minor issues:</b> ${mins.map(([k,v])=>(v>0?'For ':'Against ')+MINOR_BY[k].n.toLowerCase()).join('; ')}</div>`:''}<small class="muted">Flip-flops so far: ${G.flips}</small></div>`;
  return h;
}
function spark(){
  const H=G.pollHistory;if(H.length<2)return '';
  const W=260,Hh=70;const all=H.flatMap(p=>Object.values(p.sh));const lo=Math.min(...all)-.02,hi=Math.max(...all)+.02;
  const x=i=>i/(H.length-1)*W,y=v=>Hh-(v-lo)/(hi-lo)*Hh;
  return `<svg class="spark" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Poll trend">${G.active.map(id=>`<polyline fill="none" stroke="${colorOf(id)}" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${H.map((p,i)=>x(i).toFixed(1)+','+y(p.sh[id]||0).toFixed(1)).join(' ')}"/>`).join('')}</svg>`;
}
function recSet(){if(!UI.pending)return new Set();const k=UI.pending;
  const c=margeCandidates(G.plan).filter(r=>r.k===k&&r.a&&canTarget(k,r.a)).slice(0,5).map(r=>r.a);
  if(c.length)return new Set(c);
  return new Set(margeCandidates(G.plan).filter(r=>r.a&&canTarget(k,r.a)).slice(0,5).map(r=>r.a));}
function mapPanelHTML(){
  const prim=isPrimary();let top='';
  if(prim){const r=PRIMARY_ROUNDS[G.round-1];
    top=`<h3>Now voting: ${r.n}</h3><p class="muted" style="margin:0">Only the outlined states vote this round, so only they can be targeted. Delegates on the line: ${r.st.reduce((x,a)=>x+ST[a].ev*10,0)}.</p>`;}
  else{const ev=VIEW.sum.ev;const ids=G.active.slice().sort((a,b)=>(a==='P'?-1:b==='P'?1:0));
    top=`<div class="evlegend">${ids.map(id=>`<div><span class="dot" style="background:${colorOf(id)}"></span> ${esc(G.cands[id].name)} <span class="num">${ev[id]}</span></div>`).join('')}<div class="muted" data-tip="${esc(TIPS.ev)}" tabindex="0">270 to win <span class="qm">?</span></div></div>
     <div class="evbar">${ids.map(id=>`<span style="width:${ev[id]/538*100}%;background:${colorOf(id)}"></span>`).join('')}<i class="mark"></i></div>
     <small class="muted">Projected from state polls${G.plan.length?', including this week’s plan':''}. Polls have a margin of error.</small>`;}
  const picking=!!UI.pending;const recs=recSet();
  return `<div class="map-wrap">${top}
   ${picking?`<div class="pick-banner"><span>Choose a state for: ${ACTIONS[UI.pending].n}. Gold rings are Marge’s top picks; hover to preview the gain.</span><button class="btn sm" data-act="cancelpick">Cancel</button></div>`:''}
   <div class="map-body"><div><div style="display:flex;justify-content:flex-end;margin-top:8px">${mapToggleHTML()}</div>${UI.mapMode==='real'?`<div class="${picking?'picking':''}">${svgMap(a=>tileStyle(a,picking,recs),true)}</div>`:`<div class="tiles ${picking?'picking':''}">${ST_LIST.map(s=>tileHTML(s,picking,recs)).join('')}</div>`}
   <div class="legend">${prim?`<span><i style="box-shadow:inset 0 0 0 3px var(--chyron);background:var(--tile)"></i>Votes this round</span>`:`<span><i style="background:${colorOf('P')}"></i>You lead (darker = bigger lead)</span>`}<span><i style="background:var(--chyron);border-radius:50%"></i>In your plan</span>${!prim&&P().party==='C'?'<span><i style="outline:2px dashed var(--muted);outline-offset:-2px;background:var(--tile)"></i>Not on your ballot</span>':''}</div>
   </div><div class="state-info" id="stateinfo">${stateInfo(UI.hover)}</div></div></div>`;
}
function tileStyle(a,picking,recs){
  let fill='',cls='',light=false;const prim=isPrimary();
  if(prim){const contest=PRIMARY_ROUNDS[G.round-1].st.includes(a);
    if(G.pResults&&G.pResults[a]){fill=`color-mix(in srgb, ${colorOf(G.pResults[a])} 75%, var(--tile))`;light=true;}
    else if(!contest&&!picking)cls+=' dim';if(contest)cls+=' contest';}
  else{const sh=VIEW.disp[a];let best=null,bv=-1,sec=0;for(const id in sh){if(sh[id]>bv){sec=Math.max(bv,0);bv=sh[id];best=id;}else if(sh[id]>sec)sec=sh[id];}
    const pc=clamp(18+(bv-sec)*420,18,90);fill=`color-mix(in srgb, ${colorOf(best)} ${pc.toFixed(0)}%, var(--tile))`;light=pc>52;}
  if(picking&&!canTarget(UI.pending,a))cls+=' dim';else if(picking&&recs.has(a))cls+=' rec';
  if(G.plan.some(p=>p.a===a))cls+=' planned';if(light)cls+=' light';
  return {fill,cls,off:!prim&&P().party==='C'&&!onBallot(P(),a)};
}
function tileHTML(s,picking,recs){
  const t=tileStyle(s.a,picking,recs);
  return `<button class="tile${t.cls}" style="grid-row:${s.r+1};grid-column:${s.c+1};${t.fill?'background:'+t.fill:''}${t.off?';outline:2px dashed var(--muted);outline-offset:-3px':''}" data-act="tile" data-v="${s.a}" aria-label="${s.n}, ${s.ev} electoral votes">${s.a}<small>${s.ev}</small></button>`;
}
const SMALL_ST=['VT','NH','MA','RI','CT','NJ','DE','MD','DC'];
function svgMap(styleFn,interactive){
  const paths=ST_LIST.map(s=>{const t=styleFn(s.a);return `<path d="${US_PATHS[s.a]}" class="st${t.cls||''}" style="${t.fill?'fill:'+t.fill:''}${t.off?';stroke-dasharray:4 3':''}" ${interactive?`data-act="tile" data-v="${s.a}" tabindex="0" role="button" aria-label="${s.n}, ${s.ev} electoral votes"`:''}><title>${s.n} (${s.ev})</title></path>`;}).join('');
  const labels=ST_LIST.filter(s=>!SMALL_ST.includes(s.a)&&US_CEN[s.a]).map(s=>{const t=styleFn(s.a);const[x,y]=US_CEN[s.a];return `<text x="${x}" y="${y}" class="stl${(t.cls||'').includes('light')?' light':''}">${s.a}</text>`;}).join('');
  const boxes=SMALL_ST.map((a,i)=>{const t=styleFn(a);const y=120+i*40;return `<g ${interactive?`data-act="tile" data-v="${a}" tabindex="0" role="button" aria-label="${ST[a].n}, ${ST[a].ev} electoral votes"`:''} class="stbox${t.cls||''}"><rect x="985" y="${y}" width="62" height="32" rx="5" style="${t.fill?'fill:'+t.fill:''}"/><text x="1016" y="${y+21}" class="stl${(t.cls||'').includes('light')?' light':''}">${a} ${ST[a].ev}</text></g>`;}).join('');
  return `<svg class="usmap" viewBox="0 0 1060 610" role="group" aria-label="Map of the United States">${paths}${labels}${boxes}</svg>`;
}
function mapToggleHTML(){const m=UI.mapMode||'tiles';return `<div class="seg" role="group" aria-label="Map style"><button class="${m==='tiles'?'on':''}" data-act="mapmode" data-v="tiles">Tiles</button><button class="${m==='real'?'on':''}" data-act="mapmode" data-v="real">Map</button></div>`;}
function streetQuote(a){
  const s=ST[a],bk=DOM_BLOC[s.p];
  const pres=eff('P',a)+G.plan.filter(p=>p.a===a&&p.k!=='petition').length*5;
  const sh=VIEW.disp[a];const mine=sh.P||0;const other=Math.max(...Object.entries(sh).filter(([k])=>k!=='P').map(([,v])=>v));const ahead=mine>other;
  let presLine;
  if(pres>=8)presLine=ahead?'You keep showing up here, and it shows.':'I see your signs everywhere. Still not sold.';
  else if(pres>=2)presLine='Saw your ad once or twice. It was fine.';
  else presLine=ahead?'Haven’t seen you around, but I like what I hear.':'Never seen you here. Do you even know where we are?';
  return {text:`${presLine} ${hintLine(bk)}`,who:seeded(VOICE_NAMES[bk],a+G.week)+', '+BNAME[bk].toLowerCase()};
}
function stateInfo(a){
  if(!a)return '<span class="muted">Hover a state to see its polls and what voters there think of you. To act, pick an action on the right, then click a state.</span>';
  const s=ST[a];const prim=isPrimary();const sh=VIEW.disp[a];const ids=prim?G.primaryField:G.active;
  const myEff=eff('P',a);const inPlan=G.plan.filter(p=>p.a===a);
  let prev='';
  if(UI.pending){if(canTarget(UI.pending,a)){if(UI.pending==='attack'){const g=gainFor('attack',a);prev=`<div class="preview">Attack ad here hits ${esc(G.cands[leadOppIn(a)].name)}: you ${pct(sh.P)}% → ${pct(sh.P+g)}% (${sgn(g*100)} pts) for ${money(costOf('attack',a))}</div>`;}else if(UI.pending==='petition')prev=`<div class="preview">Petition here: get on the ballot in ${s.n} (${s.ev} electoral votes)</div>`;
      else{const g=gainFor(UI.pending,a);prev=`<div class="preview">${ACTIONS[UI.pending].n} here: you ${pct(sh.P)}% → ${pct(sh.P+g)}% (${sgn(g*100)} pts)${UI.pending==='ad'?' for '+money(costOf('ad',a)):''}</div>`;}}
    else prev=`<div class="preview">Can’t target ${s.n}${prim?': it doesn’t vote this round':!onBallot(P(),a)?': you’re not on the ballot':': not enough cash'}.</div>`;}
  const q=streetQuote(a);
  return `<b>${s.n}</b> <span class="muted">${s.ev} electoral votes${prim?' ('+s.ev*10+' delegates)':' | '+leanText(s.lean)}</span>
   <div style="display:flex;gap:4px 14px;flex-wrap:wrap;margin-top:4px">${ids.slice().sort((x,y)=>(sh[y]||0)-(sh[x]||0)).map(id=>{const pv=!prim&&G.prevPolls&&G.prevPolls[a]?G.prevPolls[a][id]:null;const d=pv!==null&&pv!==undefined&&G.polls?G.polls[a][id]-pv:null;return `<span><span class="dot" style="background:${colorOf(id)}"></span> ${esc(G.cands[id].name)} <span class="num" style="font-size:18px">${pct(sh[id]||0)}%</span>${d!==null?` <small class="${d>=0?'up':'down'}">${sgn(d*100)} this week</small>`:''}</span>`;}).join('')}</div>
   <small class="muted">Your presence here: ${myEff<1?'none':myEff<6?'light':myEff<14?'solid':'heavy'}${inPlan.length?'. In your plan: '+inPlan.map(p=>ACTIONS[p.k].n.toLowerCase()).join(', '):''}${!prim&&P().party==='C'&&!onBallot(P(),a)?'. Not on the ballot':''}</small>
   ${prev}<div class="voice">“${esc(q.text)}” <span class="muted" style="font-style:normal">— ${esc(q.who)}</span></div>`;
}
function leanText(l){if(Math.abs(l)<1)return 'Pure toss-up';return (l>0?'Usually leans Democratic by ':'Usually leans Republican by ')+Math.abs(l);}
function planHTML(){
  const left=apLeft();
  return `<div class="panel plan-panel"><h3>This ${isPrimary()?'round':'week'}’s plan</h3>
   <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap" data-tip="${esc(TIPS.staff)}" class="tip-r">${Object.entries(STAFF).map(([k,v])=>`<button class="btn sm ${G.staff===k?'primary':''}" data-act="staff" data-v="${k}">${v.n}: ${v.ap} actions, ${money(v.cost)}/wk</button>`).join('')}</div>
   ${G.plan.map((it,i)=>`<div class="plan-item"><b>${esc(planLabel(it))}</b><button class="x" data-act="unplan" data-v="${i}" aria-label="Remove ${esc(planLabel(it))}">×</button><small>${esc(planEffectText(it))}${costOf(it.k,it.a,it)>0?' | '+money(costOf(it.k,it.a,it)):''}</small></div>`).join('')}
   ${Array.from({length:Math.max(0,left)},()=>'<div class="slot">Open action. Pick one below.</div>').join('')}
   ${UI.flash?`<div class="flash" role="alert">${esc(UI.flash)}</div>`:''}
   <small class="muted">Staff payroll at week’s end: ${money(staffCost())}. Cash after plan: ${money(cashAfter())}.</small>
   <button class="btn chy" style="width:100%;margin-top:8px" data-act="endweek">${isPrimary()?'Go to the polls':'End week'}${left>0?` (${left} unused)`:''}</button></div>`;
}
function actionsHTML(){
  const keys=['rally','ad','attack','ground','spouse','fund','donor','interview','speech','poll','endorse','oppo','release','prep','petition','bury','confess'].filter(actionAvail);
  return `<div class="panel"><h3>Add an action</h3>
   ${keys.map(k=>{const A=ACTIONS[k];const w=whyNot(k);
     return `<button class="act ${UI.pending===k?'sel':''} tip-r" data-act="action" data-v="${k}" ${apLeft()<=0||(w&&!A.target)?'disabled':''} ${w?`data-tip="${esc(w)}"`:''}><span><b>${A.n}${A.target?' <small style="display:inline">→ pick a state</small>':A.modal?' <small style="display:inline">→ choose</small>':''}</b><small>${A.d}</small></span><span class="cost">${actionCostText(k)}</span></button>`;}).join('')}
   ${G.prep||planned('prep')?`<small class="muted">Debate prep: ${G.prep} done${planned('prep')?', '+planned('prep')+' planned':''} (max 3)</small>`:''}
  </div>`;
}
function staffHTML(){
  const adv=margeAdvice();const t=adv.top;
  return `<div class="panel staff"><h3>Staff</h3>
   <p><b>Marge, campaign manager</b>${esc(adv.situation)}</p>
   ${t&&apLeft()>0?`<div class="marge-rec"><div class="row"><span><b>${esc(recLabel(t))}</b>${esc(t.why)}</span><button class="btn sm" data-act="margeadd" aria-label="Add Marge’s suggestion">Add</button></div></div>`:''}
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><button class="btn sm" data-act="coach">Coaching</button>${apLeft()>0?'<button class="btn sm" data-act="margeplan">Let Marge plan this week</button>':''}</div>
   <p><b>Tanner, intern</b>${esc(G.intern)}</p></div>`;
}
function tickerHTML(){
  const items=G.ticker.map(t=>`<span><em>${esc(t.net)}</em>${esc(t.text)}</span>`).join('');
  return `<div class="ticker" aria-live="off"><div class="lab">Live</div><div style="overflow:hidden;flex:1"><div class="roll">${items}${items}</div></div></div>`;
}
function tutOfferHTML(){
  return `<div class="overlay center" role="dialog" aria-modal="true" aria-label="Tutorial"><div class="lt"><div class="lt-head"><div class="tag">First campaign?</div><h2>Want a quick walkthrough?</h2></div><div class="lt-body">
   <p>Marge will walk you through your first week in about two minutes: reading the map, planning actions, and seeing results. You can skip it anytime, and the Guide is always available from the top bar.</p>
   <div class="title-actions"><button class="btn chy" data-act="tutyes" data-autofocus>Show me around</button><button class="btn" data-act="tutno">Skip, I’ll figure it out</button></div></div></div></div>`;
}
function coachHTML(){
  const s=TUT[UI.tut];
  return `<div class="coach" role="status"><b>${esc(s.t)}</b><p>${esc(s.x)}</p><div class="row"><button class="skip" data-act="tutskip">Skip tutorial</button><span class="muted" style="color:var(--surface);opacity:.7;font-size:13px">${UI.tut+1} of ${TUT.length}</span>${s.wait?'':`<button class="btn sm" data-act="tutnext">${UI.tut===TUT.length-1?'Finish':'Next'}</button>`}</div></div>`;
}

function modalHTML(){
  const m=UI.modal;if(!m)return '';
  let tag='Breaking',title='',body='',wide=false;
  if(m.type==='event'){const e=m.ev;title=fill(e.t,m.extra);
    body=`<p>${esc(fill(e.x,m.extra))}</p><div class="choices">${e.c.map((ch,i)=>{const iss=ch.fx.issue;let hint='';
      if(iss){const cur=P().pos[iss[0]];hint=Math.abs(cur)>=.3&&Math.sign(cur)!==iss[1]?'<span class="hint flip">Flip-flop</span>':Math.abs(cur)<.3?'':'<span class="hint strong">Matches your platform</span>';}
      if(ch.fx.minor){const cur=(P().minor||{})[ch.fx.minor[0]];if(cur&&cur!==ch.fx.minor[1])hint='<span class="hint flip">Reverses your stance</span>';else if(cur)hint='<span class="hint strong">Matches your stance</span>';}
      return `<button class="choice" data-act="evchoice" data-v="${i}" ${i===0?'data-autofocus':''}>${hint}${esc(fill(ch.l,m.extra))}</button>`;}).join('')}</div>`;}
  if(m.tag)tag=m.tag;
  if(m.type==='vp'){tag='Convention';title='Choose your running mate';wide=true;
    body=`<p>The convention floor is waiting. Vetting a candidate costs ${money(1)} and reveals any hidden baggage. Skip it and you might get a surprise later.</p><div class="opts">${m.opts.map((o,i)=>`<div class="opt" style="cursor:default"><b>${esc(o.name)}</b><small>${o.n}, ${ST[o.home].n} (+3 there)</small><small>${o.d}</small><small>${esc(bioText(o.bio))}</small>
      <small>${o.vetted?(o.baggage?`<span class="down">Baggage: ${esc(o.baggage)}</span>`:'<span class="up">Vetted: clean record</span>'):'Not vetted'}</small>
      <div style="display:flex;gap:6px;margin-top:8px">${o.vetted?'':`<button class="btn sm" data-act="vet" data-v="${i}" ${G.cash<1?'disabled':''}>Vet (${money(1)})</button>`}<button class="btn sm primary" data-act="vp" data-v="${i}" ${i===0?'data-autofocus':''}>Pick</button></div></div>`).join('')}</div>`;}
  if(m.type==='platform'){tag='Convention';title='Platform fight on the convention floor';
    const f=m.f;body=`<p>${esc(f.wing.charAt(0).toUpperCase()+f.wing.slice(1))} demands ${esc(f.n)}.${f.i!==null?` That would put you at ${esc(posText(f.i,f.to))} (you’re at ${esc(posText(f.i,P().pos[f.i]))}).`:''}</p>${G.unity<0?'<p class="muted">Your primary was bitter. Some of your rivals’ supporters are still sulking.</p>':''}
     <div class="choices"><button class="choice" data-act="platform" data-v="accept" data-autofocus>Accept the plank<small>The base is thrilled. Moderates notice.</small></button>
     <button class="choice" data-act="platform" data-v="compromise">Negotiate a compromise<small>Meet them halfway.</small></button>
     <button class="choice" data-act="platform" data-v="refuse">Refuse and fight it on the floor<small>You look independent. The base is angry.</small></button></div>`;}
  if(m.type==='speech'){tag='Policy speech';title='Shift a position';const c=P();const from=c.pos[m.i];const lo=clamp(from-.5,-2,2),hi=clamp(from+.5,-2,2);const to=clamp(m.to,lo,hi);const cost=speechCost(from,to);
    body=`<p>Pick one issue and move up to 25% in either direction. Small moves are a cheap “clarification.” Big ones cost credibility and count as a flip-flop.</p>
     <div class="field"><label for="spi">Issue</label><select id="spi" data-act-input="speechi">${ISSUES.map((is,i)=>`<option value="${i}" ${i===m.i?'selected':''}>${is.n} (${esc(posText(i,c.pos[i]))})</option>`).join('')}</select></div>
     <div class="field"><label>New position</label><input type="range" min="${Math.round(lo*50)}" max="${Math.round(hi*50)}" step="5" value="${Math.round(to*50)}" data-act-input="speechto" style="width:100%" aria-label="New position">
      <div class="slider-ends"><span>${esc(posText(m.i,lo))}</span><span>${esc(posText(m.i,hi))}</span></div>
      <p id="speechlbl" style="font-weight:600">${esc(posText(m.i,to))}. Credibility −${cost}${Math.abs(to-from)>=.4?' (flip-flop)':''}</p></div>
     <div class="title-actions"><button class="btn chy" data-act="speechok" ${Math.abs(to-from)<.05?'disabled':''}>Add to plan</button><button class="btn" data-act="close">Cancel</button></div>`;}
  if(m.type==='oppo'){tag='Opposition research';title='Dig for dirt';
    body=`<p>Pick a target and how you dig. At 100% you can release what you found, ideally when it hurts most.</p><div class="choices">${opponents().map(id=>`<button class="choice ${m.target===id?'':''}" data-act="oppotarget" data-v="${id}" style="${m.target===id?'border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)':''}">${esc(fullName(G.cands[id]))}<small>Dirt found so far: ${Math.round(G.dirt[id]||0)}%</small></button>`).join('')}</div>
     <div class="choices"><button class="choice" data-act="oppogo" data-v="clean" ${cashAfter()<costOf('oppo',null,{method:'clean'})?'disabled':''}>Clean digging (${money(costOf('oppo',null,{method:'clean'}))})<small>Public records and old interviews. +30%. No risk.</small></button>
     <button class="choice" data-act="oppogo" data-v="dirty" ${cashAfter()<costOf('oppo',null,{method:'dirty'})?'disabled':''}>Dirty digging (${money(costOf('oppo',null,{method:'dirty'}))})<small>Private eyes and dumpsters. +55%. 20% chance it leaks and backfires on you.</small></button>
     <button class="btn" data-act="close">Cancel</button></div>`;}
  if(m.type==='release'){tag='Opposition research';title='Release the dirt';
    body=`<p>${!isPrimary()&&G.weeks-G.week<=2?'It’s October. Dirt released now does 50% more damage.':'Dirt does 50% more damage in the final two weeks of the general election. You can also hold it.'}</p><div class="choices">${dirtReady().map(id=>`<button class="choice" data-act="releasego" data-v="${id}">Release the dirt on ${esc(G.cands[id].name)}<small>${esc(G.cands[id].secret)}</small></button>`).join('')}<button class="btn" data-act="close">Hold it for now</button></div>`;}
  if(m.type==='endorse'){tag='Endorsements';title='Court an endorsement';
    body=`<p>Each costs ${money(costOf('endorse'))} and an action. Your odds are much better if you already meet what they want.</p><div class="choices">${availEndorsers().map(e=>`<button class="choice" data-act="endorsego" data-v="${e.id}" ${cashAfter()<costOf('endorse')?'disabled':''}>${esc(e.state?'The governor of '+ST[G.govState].n:e.n)} <span class="hint ${endorseMet(e)?'strong':'risky'}">${Math.round(endorseChance(e)*100)}% chance</span><small>${esc(e.hint.charAt(0).toUpperCase()+e.hint.slice(1))}. Boosts: ${Object.keys(e.fx).map(b=>BNAME[b].toLowerCase()).join(', ')}${e.state?', and '+ST[G.govState].n:''}${e.cash?', plus cash':''}.</small></button>`).join('')}<button class="btn" data-act="close">Cancel</button></div>`;}
  if(m.type==='string'){tag='Donor';title=`${m.str.donor} calls in the favor`;
    body=`<p>Two weeks ago they gave big. Now they want you to move ${m.str.dir<0?'left':'right'} on ${ISSUES[m.str.i].n.toLowerCase()}. You’re currently at ${esc(posText(m.str.i,P().pos[m.str.i]))}.</p>
     <div class="choices"><button class="choice" data-act="string" data-v="comply" data-autofocus>Give them what they want<small>Your position shifts 25%. Might count as a flip-flop.</small></button>
     <button class="choice" data-act="string" data-v="refuse">Tell them no<small>No more donor dinners for 3 weeks, and they may leak things.</small></button></div>`;}
  if(m.type==='eventResult'){title=m.title;body=`<p>${esc(m.r)}</p>${fxHTML(m.list)}<div class="choices"><button class="btn primary" data-act="close" data-autofocus>Back to the campaign</button></div>`;}
  if(m.type==='note'){tag='Update';title=m.title;body=`${m.html}<div class="choices"><button class="btn primary" data-act="close" data-autofocus>Continue</button></div>`;}
  if(m.type==='scandal'){tag='Exclusive';title='Your secret is out';
    body=`<p>${esc(G.secret)}. Every network is running it, and your phone will not stop buzzing.</p><div class="choices">
     <button class="choice" data-act="scandal" data-v="apologize" data-autofocus>Apologize and own it<small>A guaranteed, moderate hit.</small></button>
     <button class="choice" data-act="scandal" data-v="deny">Deny everything<small>Coin flip: it fizzles, or it gets much worse.</small></button>
     <button class="choice" data-act="scandal" data-v="media">Attack the media for covering it<small>Your base rallies; everyone else is unimpressed.</small></button></div>`;}
  if(m.type==='vp_old'){tag='Convention';title='Choose your running mate';
    body=`<p>The convention floor is waiting. Your pick says a lot about you.</p><div class="opts">${m.opts.map((o,i)=>`<button class="opt" data-act="vp" data-v="${i}" ${i===0?'data-autofocus':''}><b>${esc(o.name)}</b><small>${o.n}, ${ST[o.home].n} (+3 there)</small><small>${o.d}</small></button>`).join('')}</div>`;}
  if(m.type==='recap'){tag='Recap';title=m.title;wide=true;body=recapHTML(m);}
  if(m.type==='coach'){tag='Coaching';title='Marge’s game plan';wide=true;body=coachModalHTML();}
  if(m.type==='primaryResults'){tag='Results';wide=true;title=`${PRIMARY_ROUNDS[m.round-1].n}: ${G.cands[m.roundWin].name} wins`;
    body=`${m.notes.length?`<h3 style="font-size:20px">Your campaign this round</h3><ul>${m.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:''}
     ${m.ai.length?`<p class="muted">${m.ai.map(esc).join(' ')}</p>`:''}
     <table class="res-table"><tr><th>State</th>${(m.field||G.primaryField).map(id=>`<th><span class="dot" style="background:${colorOf(id)}"></span> ${esc(G.cands[id].name.split(' ').slice(-1)[0])}</th>`).join('')}</tr>
     ${m.rows.map(r=>`<tr><td>${ST[r.a].n}</td>${(m.field||G.primaryField).map(id=>`<td class="num" style="${r.win===id?'font-weight:700':''}">${pct(r.sh[id])}%</td>`).join('')}</tr>`).join('')}
     <tr><td><b>Delegates this round</b></td>${(m.field||G.primaryField).map(id=>`<td class="num">${m.roundDel[id]}</td>`).join('')}</tr>
     <tr><td><b>Total delegates</b></td>${(m.field||G.primaryField).map(id=>`<td class="num"><b>${G.delegates[id]}</b></td>`).join('')}</tr></table>
     ${m.drops&&m.drops.length?`<p><b>Dropping out:</b> ${m.drops.map(d=>`${esc(G.cands[d.id].name)} (endorses ${esc(d.to==='P'?'you':G.cands[d.to].name)})`).join('; ')}</p>`:''}
     <p class="muted">${m.roundWin==='P'?'Winning the round gives you a momentum boost going forward.':`${esc(G.cands[m.roundWin].name)} gets a momentum boost from winning the round.`}${m.round<G.rounds?` Next up: ${PRIMARY_ROUNDS[m.round].n}.`:''}</p>
     <div class="choices"><button class="btn primary" data-act="primnext" data-autofocus>${m.round<G.rounds?'On to the next round':'See who wins the nomination'}</button></div>`;}
  if(m.type==='debate'){tag='Debate night';const opp=mainOpp();const oc=opp?G.cands[opp]:null;
    if(m.done){title=m.done==='won'?'You won the debate':m.done==='lost'?'You lost the debate':'The debate is a draw';
      body=`<div class="dial"><i style="left:calc(${clamp(50+m.score*12,2,98)}% - 2px)"></i></div><p>${m.done==='won'?'Focus groups are glowing. Momentum +4, credibility +2.':m.done==='lost'?'Focus groups wince. Momentum −3.':'Both sides claim victory. No real change.'}</p>
      <div class="choices"><button class="btn primary" data-act="close" data-autofocus>Back to the campaign</button></div>`;}
    else{const q=m.qs[m.i];title=`Question ${m.i+1} of ${m.qs.length}`;const qt=q.type==='minorq'?'policy':q.type;
      body=`${m.i===0&&oc?`<p class="muted">On stage with ${esc(fullName(oc))}. ${esc(oc.blurb||'')} ${G.prep?`You did ${G.prep} prep session${G.prep>1?'s':''} (+${G.prep*7}% on every answer).`:'You did no debate prep.'}${G.prep<2?' With 2 or more prep sessions you’d see exact odds.':''}</p>`:''}
       <div class="dial" aria-label="Focus group reaction"><i style="left:calc(${clamp(50+m.score*10,2,98)}% - 2px)"></i></div>
       <p style="font-size:18px;font-weight:600">Moderator: ${esc(fill(q.t))}</p>`;
      if(m.stage==='ask')body+=`<div class="choices">${q.answers.map((a,i)=>{const p=debP(a.style,qt);const [cls,lab]=hintFor(p);
          return `<button class="choice" data-act="debate" data-v="${i}" ${i===0?'data-autofocus':''}>“${esc(fill(a.text))}”<small><span class="hint ${cls}">${lab}${G.prep>=2?' '+Math.round(p*100)+'%':''}</span>${a.flip||a.flipm?'<span class="hint flip">Flip-flop</span>':''}${STYLE_NAME[a.style]}${a.flip?': moves your position and costs credibility':a.flipm?': reverses your stance':''}</small></button>`;}).join('')}</div>`;
      else{body+=`<p><b>You:</b> “${esc(m.answered.quote)}”</p><p class="${m.answered.ok?'up':'down'}" style="font-weight:600">${esc(m.answered.txt)}</p>`;
        if(m.stage==='answered')body+=`<p><b>${esc(m.rebuttal)}</b></p><div class="choices"><button class="choice" data-act="rebut" data-v="counter" data-autofocus>Counter it<small>${hintFor(debP('attack','attack')-.05)[1]}. Win the exchange or lose the thread.</small></button>${m.zinger?`<button class="choice" data-act="rebut" data-v="zinger">Interrupt with a zinger<small>Once per debate. Big win or a big flop.</small></button>`:''}<button class="choice" data-act="rebut" data-v="slide">Let it slide<small>Safe, but costs you a little.</small></button></div>`;
        else{if(m.rebutRes)body+=`<p><b>${esc(m.rebuttal)}</b></p><p class="${m.rebutRes.ok?'up':'down'}" style="font-weight:600">${esc(m.rebutRes.txt)}</p>`;
          body+=`<div class="choices"><button class="btn primary" data-act="debnext" data-autofocus>${m.i+1<m.qs.length?'Next question':'See the verdict'}</button></div>`;}}}
  }
  const closable=m.type==='coach';
  return `<div class="overlay ${m.type==='coach'?'center':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="lt ${wide?'wide':''}"><div class="lt-head"><div class="tag">${tag}</div><h2>${esc(title)}</h2>${closable?'<button class="closex" data-act="close" aria-label="Close">×</button>':''}</div><div class="lt-body">${body}</div></div></div>`;
}
function recapHTML(m){
  const r=m.recap;const dNat=r.nat[1]-r.nat[0];const dEv=r.ev[1]-r.ev[0];const c=P();
  const card=(lab,val,d,fmt)=>`<div class="rcard"><small>${lab}</small><span class="num">${val}</span>${d===null?'':`<small class="${d>=0?'up':'down'}">${d>=0?'▲':'▼'} ${fmt(Math.abs(d))}</small>`}</div>`;
  const news=(r.news||[]);
  let h=`<div class="recap">${news.length?`<div class="newsbar">${news.map(n=>`<div><span class="tagx">${{comeback:'Comeback mode',scandal:'Scandal',endorse:'Endorsement',drop:'Dropout'}[n.kind]||'News'}</span>${esc(n.text)}</div>`).join('')}</div>`:''}
   <div class="rcards">${card('National polling',pct(r.nat[1])+'%',dNat,v=>pct(v)+' pts')}${card('Electoral votes',r.ev[1],dEv,v=>v)}${card('Momentum',sgn(c.mom),null)}${card('Cash',money(G.cash),null)}</div>
   <div class="rgrid"><div><b>Where you gained and lost</b>
    <div class="tiles mini">${ST_LIST.map(s=>{const mv=r.moves.find(x=>x.a===s.a);const d=mv?mv.d:0;const col=d>=0?'var(--good)':'var(--bad)';const pc=clamp(Math.abs(d)*2500,0,85);return `<div class="tile ${pc>45?'light':''}" style="grid-row:${s.r+1};grid-column:${s.c+1};background:color-mix(in srgb, ${col} ${pc.toFixed(0)}%, var(--tile))" title="${s.n}: ${sgn(d*100)}">${s.a}</div>`;}).join('')}</div>
    <small class="muted">Green: you gained. Red: you lost. Darker means a bigger change.</small></div>
    <div><b>Poll trend</b>${trendSVG(240,110)}
    <b style="display:block;margin-top:10px">Biggest moves</b>${r.moves.slice(0,5).map(x=>`<div class="mvrow"><span>${ST[x.a].n}</span><span class="mvbar"><i style="width:${clamp(Math.abs(x.d)*2000,4,100)}%;background:${x.d>=0?'var(--good)':'var(--bad)'}"></i></span><span class="num ${x.d>=0?'up':'down'}">${sgn(x.d*100)}</span></div>`).join('')||'<small class="muted">Nothing moved much.</small>'}</div></div>
   ${r.attacks&&r.attacks.length?`<b>Attacks on you</b><ul>${r.attacks.map(t=>`<li class="down">${esc(t)}</li>`).join('')}</ul>`:''}
   <b>Focus group</b>${r.quotes.map(q=>`<div class="quote">“${esc(q.text)}”<small>${esc(q.who)}</small></div>`).join('')}`;
  if(m.expanded){
    h+=`<h3 style="font-size:20px;margin-top:14px">What you did</h3><ul>${r.notes.map(n=>`<li>${esc(n)}</li>`).join('')||'<li>No actions this week.</li>'}</ul>
     ${r.ai.length?`<h3 style="font-size:20px">The competition</h3><ul>${r.ai.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
     <h3 style="font-size:20px;margin-top:14px">Every state that moved</h3><table class="res-table"><tr><th>State</th><th>Change</th><th>You now</th><th>Electoral votes</th></tr>
     ${r.moves.map(x=>`<tr><td>${ST[x.a].n}</td><td class="num ${x.d>=0?'up':'down'}">${sgn(x.d*100)}</td><td class="num">${pct(x.now)}%</td><td class="num">${ST[x.a].ev}</td></tr>`).join('')}</table>
     <h3 style="font-size:20px;margin-top:14px">Voter groups</h3><table class="res-table"><tr><th>Group</th><th>Your support</th><th>Change</th></tr>
     ${r.blocs.map(x=>`<tr><td>${BNAME[x.b]}</td><td class="num">${pct(x.now)}%</td><td class="num ${x.d>=0?'up':'down'}">${sgn(x.d*100)}</td></tr>`).join('')}</table>
     <p class="muted">Poll changes include your actions, opponents’ actions, fading effects, national mood, natural drift, and polling noise.</p>`;
  }else if(r.notes.length)h+=`<p class="muted" style="margin-top:8px">${r.notes.length} action results, opponent activity, and full tables are in the breakdown.</p>`;
  h+=`<div class="title-actions" style="margin-top:14px"><button class="btn primary" data-act="close" data-autofocus>${m.then==='night'?'On to election night':'Start next week'}</button><button class="btn" data-act="recapexp">${m.expanded?'Show less':'Show full breakdown'}</button></div></div>`;
  return h;
}
function trendSVG(W,Hh,withEv){
  const H=G.pollHistory;if(!H||H.length<2)return '<p class="muted" style="font-size:13px">The trend appears after week one.</p>';
  const all=H.flatMap(p=>Object.values(p.sh));const lo=Math.max(0,Math.min(...all)-.02),hi=Math.min(1,Math.max(...all)+.02);
  const x=i=>i/(H.length-1)*W,y=v=>Hh-(v-lo)/(hi-lo||1)*Hh;
  return `<svg viewBox="0 0 ${W} ${Hh+16}" style="width:100%;height:auto;display:block" role="img" aria-label="National poll trend">${G.active.map(id=>`<polyline fill="none" stroke="${colorOf(id)}" stroke-width="2.5" vector-effect="non-scaling-stroke" points="${H.map((p,i)=>x(i).toFixed(1)+','+y(p.sh[id]||0).toFixed(1)).join(' ')}"/>`).join('')}
   <text x="0" y="${Hh+13}" class="axl">Start</text><text x="${W}" y="${Hh+13}" class="axl" text-anchor="end">Week ${H[H.length-1].w}</text></svg>`;
}
function coachModalHTML(){
  const adv=margeAdvice();const recs=margeTop(5);const c=P();
  let tips=[];
  if(isPrimary())tips.push('Primary voters reward conviction. A platform close to your party’s base plays better here than in the general.','Only this round’s states vote. Put every action into them, and favor the big delegate prizes.');
  else{tips.push('Concentrate on 3–5 close states worth the most electoral votes. Spreading thin moves nothing.','Rallies fade about 30% a week and ads about 25%, so keep returning to the states that matter.');
    if(c.party==='C')tips.push('As your own party, win where your base groups are common, get on the ballot early, and reach 15% nationally to make the debate stage.');}
  if(c.cred<55)tips.push('Your credibility is low. Avoid choices marked “Flip-flop” for a while.');
  if(!isPrimary()){const bs=blocSupport();const weak=BK.slice().sort((a,b)=>bs[a]-bs[b])[0];tips.push(`Your weakest group is ${BNAME[weak].toLowerCase()}. ${hintLine(weak)} A policy speech could close the gap.`);}
  else tips.push('Primary voters care most about a few core issues. If you’re short on one, a policy speech or an internal poll can help.');
  if(dirtReady().length)tips.push('You have dirt ready to release. It hits 50% harder in the last two weeks of the general.');
  if(G.secretState==='hidden')tips.push(`Your secret is at ${Math.round(G.exposure)}% exposure. Coming clean early costs less than getting caught.`);
  return `<p><b>Where we stand:</b> ${esc(adv.situation)}</p>
   <h3 style="font-size:20px">Best moves right now</h3>
   ${recs.length?recs.map((r,i)=>`<div class="marge-rec"><div class="row"><span><b>${esc(recLabel(r))}</b> ${r.gain!==undefined?`<span class="up">${sgn(r.gain*100)} pts</span>`:''}<br><small class="muted">${esc(r.why)}</small></span>${apLeft()>0?`<button class="btn sm" data-act="coachadd" data-v="${i}">Add to plan</button>`:''}</div></div>`).join(''):'<p class="muted">Your plan is full. End the week when you’re ready.</p>'}
   <h3 style="font-size:20px;margin-top:12px">Strategy</h3><ul>${tips.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
   <div class="title-actions">${apLeft()>0?'<button class="btn chy" data-act="margeplan">Let Marge plan the rest of this week</button>':''}<button class="btn" data-act="close">Close</button></div>`;
}
function guideHTML(){
  const tab=UI.guide;let body='';
  if(tab==='how')body=`<div class="guide"><h3>The goal</h3><p>Win your party’s nomination, then reach 270 electoral votes in the general election. Starting your own party skips the primaries but makes the general much harder.</p>
   <h3>Each week</h3><ol><li>Handle any breaking news event or debate.</li><li>Add up to 4 actions to your plan. Targeted actions (rallies, ads, ground game) need a state: click the action, then click a state.</li><li>Watch the map and polls update as you plan. Remove anything with ×. Nothing is final yet.</li><li>Press End week. Your plan runs, opponents act, new polls come in, and you get a recap.</li></ol>
   <h3>Primaries</h3><p>Three rounds: Iowa & New Hampshire, Nevada & South Carolina, then Super Tuesday. Only the states voting that round can be targeted. Delegates are split by vote share (15% minimum). Winning a round gives you momentum. Most delegates after Super Tuesday wins.</p>
   <h3>Debates</h3><p>Pick from written answers. Each shows how well it fits the question. Debate prep raises your odds, and with 2 or more sessions you see exact odds. Answers marked Flip-flop move your platform and cost credibility.</p>
   <h3>Events</h3><p>Choices marked “Matches your platform” earn credibility. Choices marked “Flip-flop” shift your position and cost credibility.</p></div>`;
  if(tab==='strategy')body=`<div class="guide"><h3>Focus beats spread</h3><p>A rally adds a few points in one state. Spread across ten states, that moves nothing that matters. Pick 3–5 close states with lots of electoral votes and keep returning, since rallies and ads fade each week.</p>
   <h3>Primaries vs. the general</h3><p>Your party’s base rewards conviction in the primaries. In the general, suburban moderates and swing groups decide most close states. Events let you drift toward the middle later, but every flip-flop costs credibility.</p>
   <h3>Money</h3><p>Rallies are free, so they’re your bread and butter. Fundraise when you want ads in big states. Donor dinners raise more but cost you with progressives and young voters.</p>
   <h3>Your own party</h3><p>Pick base groups that cluster in certain states, get on the ballot early with petition drives, and concentrate on states where your base is common. Reach 15% nationally to join the debates. Even if you can’t win, you can swing who does.</p>
   <h3>Your secret</h3><p>Exposure climbs faster when you’re leading. Burying it buys time; coming clean early is cheaper than getting caught.</p>
   <h3>Hidden thresholds</h3><p>Every voter group has a comfort zone on each issue, and the lines shift a little every game. Focus group quotes and state voices tell you when you’re close (“getting closer on guns”). An internal poll reveals one exactly, and a policy speech moves you up to 25% a week.</p>
   <h3>Going negative</h3><p>Attack ads knock down your strongest opponent in a state. Opposition research builds toward a scandal you can release when it hurts most, in October. Your opponents will do both to you.</p>
   <h3>Money</h3><p>Staff size sets your actions per week and your weekly payroll. Donor dinners raise big money, but donors sometimes attach strings.</p>
   <h3>When stuck</h3><p>Click Coaching under Staff, or let Marge plan the week and watch what she does.</p></div>`;
  if(tab==='glossary')body=`<dl class="gloss">${GLOSSARY.map(([t,d])=>`<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>`;
  return `<div class="overlay center" role="dialog" aria-modal="true" aria-label="Guide" style="z-index:30"><div class="lt wide"><div class="lt-head"><div class="tag">Guide</div><h2>How to play Politicaster</h2><button class="closex" data-act="guideclose" aria-label="Close">×</button></div><div class="lt-body">
   <div class="tabs">${[['how','How to play'],['strategy','Strategy'],['glossary','Glossary']].map(([k,n])=>`<button class="${tab===k?'on':''}" data-act="guidetab" data-v="${k}">${n}</button>`).join('')}</div>${body}</div></div></div>`;
}

function nightHTML(){
  const n=UI.night;const t=nightTotals();const ids=G.active.slice().sort((a,b)=>(a==='P'?-1:b==='P'?1:0));
  const tiles=ST_LIST.map(s=>{const x=n.st[s.a];let bg='',cls='tile',lab=`<small>${s.ev}</small>`;
    if(x.called){bg=`background:color-mix(in srgb, ${colorOf(x.called)} 85%, var(--tile))`;cls+=' light';}
    else if(x.closed&&x.rep>0){const d=nightShares(s.a);const lead=Object.keys(d).sort((a,b)=>d[b]-d[a])[0];bg=`background:color-mix(in srgb, ${colorOf(lead)} 30%, var(--tile))`;lab=`<small>${Math.round(x.rep*100)}%</small>`;}
    else if(x.closed){lab='<small>closed</small>';}
    if(x.recount){lab='<small>recount</small>';}
    return `<div class="${cls}" style="grid-row:${s.r+1};grid-column:${s.c+1};${bg}">${s.a}${lab}</div>`;}).join('');
  const key=BATTLEGROUND.concat(['FL','TX','OH']).filter((a,i,arr)=>arr.indexOf(a)===i);
  const keyHTML=key.map(a=>{const x=n.st[a];const d=x.closed&&x.rep>0?nightShares(a):null;return `<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);font-size:13px"><b>${ST[a].n}</b><span>${!x.closed?'Polls open':x.called?`<span class="dot" style="background:${colorOf(x.called)}"></span> Called`:x.recount?'Recount':d?ids.map(id=>`${esc(G.cands[id].name.split(' ').slice(-1)[0])} ${pct(d[id])}%`).join(' | ')+` (${Math.round(x.rep*100)}% in)`:'Too early'}</span></div>`;}).join('');
  let win='';
  if(n.done){const d=decideWinner();const wc=G.cands[d.winner];const won=d.winner==='P';
    win=`<div class="winner"><h2>${d.house?'No one reaches 270. The House decides: ':''}${esc(fullName(wc))} wins the presidency</h2>
     <p style="margin:6px 0 12px">${won?'Time for your victory speech. Choose your tone.':'Time to address your supporters. Choose your tone.'}</p>
     <div class="choices">${(won?SPEECHES.win:SPEECHES.lose).map((sp,i)=>`<button class="choice" data-act="finalspeech" data-v="${i}" ${i===0?'data-autofocus':''}>${esc(sp.n)}<small>${esc(sp.d)}</small></button>`).join('')}</div></div>`;}
  return `<div class="wrap"><div class="night-head"><div><div class="brand">BSN Decision Desk</div><h1>Election night</h1></div>
   <div><div class="num" style="font-size:34px">${nightClock(Math.max(0,n.step-1))}</div>${n.done?'':'<button class="btn sm" data-act="nightskip">Skip ahead</button>'}</div></div>
   <div class="evlegend" style="margin-top:14px">${ids.map(id=>`<div><span class="dot" style="background:${colorOf(id)}"></span> ${esc(G.cands[id].name)} <span class="num">${t[id]}</span></div>`).join('')}<div class="muted">270 to win</div></div>
   <div class="evbar">${ids.map(id=>`<span style="width:${t[id]/538*100}%;background:${colorOf(id)};transition:width .5s"></span>`).join('')}<i class="mark"></i></div>
   <div class="map-body" style="margin-top:14px"><div><div style="display:flex;justify-content:flex-end">${mapToggleHTML()}</div>${UI.mapMode==='real'?svgMap(a=>nightStyle(a),false):`<div class="tiles">${tiles}</div>`}<div class="legend"><span>Solid color: called. Light color: leading, with % of votes counted.</span></div></div>
   <div><div class="panel"><h3>Anchor desk</h3>${n.feed.map((f,i)=>`<p style="margin:0 0 8px;font-size:14px;${i?'opacity:.7':'font-weight:600'}">${esc(f)}</p>`).join('')}</div>
   <div class="panel"><h3>Key races</h3>${keyHTML}</div></div></div>${win}</div>`;
}
function resultsHTML(){
  const r=G.result;const c=P();let head;
  if(r.lostNomination)head=`<h1 style="font-size:52px">You lost the nomination</h1><p>${esc(fullName(G.cands[r.nominee]))} takes the ${partyName(c.party)} nomination with ${G.delegates[r.nominee]} delegates to your ${G.delegates.P}.</p><p class="muted">Tip: in the primaries, put every action into the states voting that round, especially the big delegate prizes, and keep your platform close to your party’s base.</p>`;
  else head=`<h1 style="font-size:52px">${r.won?'President-elect '+esc(c.name):'Defeated, but not forgotten'}</h1>
   <p>${r.house?'The election went to the House of Representatives. ':''}You won <b>${r.ev}</b> electoral votes and <b>${pct(r.pop)}%</b> of the popular vote.</p>
   <table class="res-table"><tr><th>Candidate</th><th>Electoral votes</th><th>Popular vote</th></tr>${G.active.slice().sort((a,b)=>r.evAll[b]-r.evAll[a]).map(id=>`<tr><td><span class="dot" style="background:${colorOf(id)}"></span> ${esc(fullName(G.cands[id]))}</td><td class="num">${r.evAll[id]}</td><td class="num">${pct(r.popAll[id])}%</td></tr>`).join('')}</table>`;
  const achAll=store.get('politicaster.ach')||{};
  return `<div class="wrap"><div class="brand">Politicaster</div>${head}
   <p class="num" style="font-size:28px;margin:6px 0">“${esc(r.title||'')}”</p>
   ${!r.lostNomination&&G.pollHistory&&G.pollHistory.length>1?`<div class="panel"><h3>Campaign timeline</h3>${trendSVG(600,160)}<div class="legend">${G.active.map(id=>`<span><i style="background:${colorOf(id)}"></i>${esc(G.cands[id].name)}</span>`).join('')}</div></div>`:''}
   ${G.speech?`<p><b>Your speech:</b> ${esc(G.speech.n)}. ${esc(G.speech.d)}</p>`:''}
   <div class="panel" style="margin-top:18px"><h3>Legacy score <span class="num">${r.legacy}</span></h3>
    <table class="res-table">${(r.breakdown||[]).map(([n,v])=>`<tr><td>${n}</td><td class="num ${v<0?'down':''}" style="text-align:right">${v>0?'+':''}${v}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="num" style="text-align:right"><b>${r.legacy}</b></td></tr></table>
    <p class="muted" style="margin:0">Flip-flops ${G.flips} | Debates won ${G.debates.won} of ${G.debates.total} | Scandals ${G.scandals}</p></div>
   <div class="panel"><h3>Achievements this campaign</h3>${r.ach.length?r.ach.map(id=>{const a=ACH.find(x=>x.id===id);return `<div style="padding:4px 0"><b>${a.n}</b>${r.fresh.includes(id)?' <span class="num up">New</span>':''} <span class="muted">${a.d}</span></div>`;}).join(''):'<p class="muted" style="margin:0">None this time. There’s always the next cycle.</p>'}
    <small class="muted">${Object.keys(achAll).filter(k=>ACH.some(a=>a.id===k)).length} of ${ACH.length} unlocked overall.</small></div>
   ${r.won?'<div class="panel"><h3>Coming in the full build</h3><p style="margin:0">Govern for four years: Congress, cabinet picks, crises, midterms, and a run for reelection.</p></div>':''}
   <div class="title-actions" style="margin-top:18px"><button class="btn chy" data-act="new">Run again</button><button class="btn" data-act="history">Campaign history</button><button class="btn" data-act="title">Back to title</button></div></div>`;
}

/* ================= DOM events ================= */
const LISTENERS=[];function LISTEN(type,fn){LISTENERS.push([type,fn]);}
LISTEN('click',e=>{Music.unlock();const el=e.target.closest('[data-act]');if(!el)return;handleAct(el.dataset.act,el.dataset.v,el.dataset);});
function handleAct(act,v,ds){
  ds=ds||{};const S=UI.S;
  if(MP.on&&mpIntercept(act,v,ds))return;
  switch(act){
   case 'new':UI.S=newSetup();UI.screen='setup';G=null;UI.tut=null;Music.play('menu');render();break;
   case 'continue':G=store.get('politicaster.save');if(G){UI.screen='game';UI.modal=null;UI.mq=[];UI.pending=null;G.plan=G.plan||[];if(G.phase==='general'&&!G.polls)computePolls();Music.play('plan');render();}break;
   case 'theme':{const r=document.documentElement;const dark=r.dataset.theme?r.dataset.theme==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;r.dataset.theme=dark?'light':'dark';store.set('politicaster.theme',r.dataset.theme);break;}
   case 'multiplayer':if(SHELL.onMultiplayer)SHELL.onMultiplayer();break;
   case 'music':Music.toggle();render();break;
   case 'sfx':SFX.toggle();render();break;
   case 'history':UI.screen='history';UI.hx=null;render();break;
   case 'hfilter':UI.hf=UI.hf||{party:'all',diff:'all'};UI.hf[ds.k]=v;render();break;
   case 'hx':UI.hx=UI.hx===+v?null:+v;render();break;
   case 'clearhist':store.set('politicaster.history',[]);render();break;
   case 'loadslot':{const x=slots()[+v];if(x){G=x.g;UI.slot=+v;ROSTER=G.roster||[];UI.screen='game';UI.modal=null;UI.mq=[];UI.pending=null;G.plan=G.plan||[];if(G.phase==='general'&&!G.polls)computePolls();Music.play('plan');render();}break;}
   case 'delslot':clearSlot(+v);render();break;
   case 'mapmode':UI.mapMode=v;store.set('politicaster.mapmode',v);render();break;
   case 'stat':{S.stats=S.stats||{...BGS[S.bg].stats};const k=ds.k,d=+v;const tot=Object.values(S.stats).reduce((a,b)=>a+b,0);if(d>0&&tot>=13){const donor=Object.keys(S.stats).filter(x=>x!==k&&S.stats[x]>1).sort((a,b)=>S.stats[b]-S.stats[a])[0];if(!donor)break;S.stats[donor]--;}S.stats[k]=clamp(S.stats[k]+d,1,5);render();break;}
   case 'title':UI.screen='title';G=null;Music.play('menu');render();break;
   case 'quit':save();UI.screen='title';UI.tut=null;Music.play('menu');render();break;
   case 'guide':UI.guide='how';render();break;
   case 'guidetab':UI.guide=v;render();break;
   case 'guideclose':UI.guide=null;render();break;
   case 'set':{let val=v;if(ds.k==='primaries')val=v==='1';S[ds.k]=val;if(ds.k==='bg')S.stats=null;S.err='';render();break;}
   case 'party':S.party=v;S.pos=v==='C'?S.cp.values.slice():DEF[v].slice();S.err='';render();break;
   case 'cpcolor':S.cp.color=v;render();break;
   case 'cpbase':{const b=S.cp.base;const i=b.indexOf(v);if(i>=0)b.splice(i,1);else{if(b.length>=2)b.shift();b.push(v);}render();break;}
   case 'reroll':S.bio=randomBio();render();break;
   case 'hobby':{const h=S.bio.hobbies;const i=h.indexOf(v);if(i>=0)h.splice(i,1);else{if(h.length>=2)h.shift();h.push(v);}render();break;}
   case 'minorset':{const k=ds.k;const val=+v;if(!val)delete S.minor[k];else{if(!S.minor[k]&&Object.keys(S.minor).length>=5){S.err='You can campaign on at most 5 minor issues.';render();return;}S.minor[k]=val;}S.err='';render();break;}
   case 'back':if(S.step===0){UI.screen='title';render();}else{S.step--;S.err='';render();}break;
   case 'next':{
     if(S.step===1&&S.party==='C'){if(!S.cp.name.trim()){S.err='Give your party a name.';render();return;}if(S.cp.base.length<2){S.err='Pick two voter groups for your base.';render();return;}S.pos=S.cp.values.slice();}
     if(S.step===2&&!S.name.trim()){S.err='Your candidate needs a name.';render();return;}
     if(S.step===3&&S.bio.hobbies.length<2){S.err='Pick two hobbies or quirks.';render();return;}
     if(S.step===5&&Object.keys(S.minor).length<3){S.err='Pick at least 3 minor issues to campaign on.';render();return;}
     if(S.step===6){startGame();Music.play('plan');return;}
     S.step++;S.err='';render();window.scrollTo(0,0);break;}
   case 'action':startAction(v);break;
   case 'unplan':removePlan(+v);break;
   case 'staff':setStaff(v);break;
   case 'cancelpick':UI.pending=null;render();break;
   case 'tile':if(UI.pending){if(canTarget(UI.pending,v))addPlan(UI.pending,v);}else{UI.hover=v;const si=document.getElementById('stateinfo');if(si)si.innerHTML=stateInfo(v);}break;
   case 'endweek':endWeek();break;
   case 'evchoice':{const m=UI.modal;const ch=m.ev.c[+v];if(!m.ev.minor){G.recentEv=(G.recentEv||[]).concat([{t:fill(m.ev.t,m.extra),choice:fill(ch.l,m.extra),turn:G.turn||0}]).slice(-5);}const list=applyFx(ch.fx,m.extra);tick(fill(m.ev.t,m.extra));UI.modal={type:'eventResult',title:fill(m.ev.t,m.extra),r:fill(ch.r,m.extra),list};render();break;}
   case 'close':{const then=UI.modal&&UI.modal.then;UI.modal=null;if(then==='weekStart')weekStart();else if(then==='night')startNight();else showNext();break;}
   case 'recapexp':UI.modal.expanded=!UI.modal.expanded;render();break;
   case 'scandal':scandalChoice(v);break;
   case 'vet':{const o=UI.modal.opts[+v];if(G.cash>=1){G.cash-=1;o.vetted=true;}render();break;}
   case 'vp':{const o=UI.modal.opts[+v];P().vp={name:o.name,home:o.home,type:o.k,baggage:o.vetted?null:o.baggage};const list=applyFx(o.fx,{});tick(`${P().name} picks ${o.name} of ${ST[o.home].n} as running mate`);
     if(o.vetted&&o.baggage)list.push(['Known baggage, already handled',0,'info']);
     computePolls();G.pollHistory=[{w:0,sh:{...G.pollSum.pop}}];G.prevBloc=blocSupport();
     UI.mq=[platformFight()];UI.modal={type:'note',title:`${o.name} joins the ticket`,html:`<p>${esc(o.d)}</p>${fxHTML(list)}`};render();break;}
   case 'platform':platformChoice(v);break;
   case 'speechok':{const m=UI.modal;const from=P().pos[m.i];const to=clamp(m.to,clamp(from-.5,-2,2),clamp(from+.5,-2,2));UI.modal=null;addPlan('speech',null,{i:m.i,from,to});break;}
   case 'oppotarget':UI.modal.target=v;render();break;
   case 'oppogo':{const t=UI.modal.target;UI.modal=null;addPlan('oppo',null,{target:t,method:v});break;}
   case 'releasego':UI.modal=null;addPlan('release',null,{target:v});break;
   case 'endorsego':UI.modal=null;addPlan('endorse',null,{id:v});break;
   case 'string':stringChoice(v);break;
   case 'primnext':UI.modal=null;afterPrimaryResults();break;
   case 'debate':answerDebate(+v);break;
   case 'rebut':rebutDebate(v);break;
   case 'debnext':nextDebate();break;
   case 'nightskip':{let g=0;while(!UI.night.done&&g++<200)nightStep();render();break;}
   case 'finalspeech':{const d=decideWinner();G.speech=(d.winner==='P'?SPEECHES.win:SPEECHES.lose)[+v];tick(`${P().name} delivers a ${G.speech.n.toLowerCase()} speech`);finish();break;}
   case 'toresults':finish();break;
   case 'coach':UI.modal={type:'coach'};render();break;
   case 'coachadd':{const r=margeTop(5)[+v];if(r)addRec(r);if(UI.modal&&UI.modal.type==='coach')render();break;}
   case 'margeadd':{const r=margeTop(1)[0];if(r)addRec(r);break;}
   case 'margeplan':margePlanWeek();if(UI.modal&&UI.modal.type==='coach')UI.modal=null;render();break;
   case 'tutyes':UI.tutOffer=false;UI.tut=0;render();break;
   case 'tutno':UI.tutOffer=false;store.set('politicaster.tutDone',true);render();break;
   case 'tutnext':UI.tut++;if(UI.tut>=TUT.length){UI.tut=null;store.set('politicaster.tutDone',true);}render();break;
   case 'tutskip':UI.tut=null;store.set('politicaster.tutDone',true);render();break;
  }
}
LISTEN('input',e=>{
  const t=e.target;const ai=t.dataset.actInput;
  if(ai==='vol'){Music.setVol(+t.value/100);return;}
  if(ai==='sfxvol'){SFX.setVol(+t.value/100);return;}
  if(MP.on&&(ai==='speechi'||ai==='speechto'))MP.log.push({act:'in:'+ai,v:t.value});
  if(ai==='speechi'){UI.modal.i=+t.value;UI.modal.to=P().pos[+t.value];render();return;}
  if(ai==='speechto'){UI.modal.to=+t.value/50;const from=P().pos[UI.modal.i];const lbl=document.getElementById('speechlbl');const cost=speechCost(from,UI.modal.to);if(lbl)lbl.textContent=`${posText(UI.modal.i,UI.modal.to)}. Credibility −${cost}${Math.abs(UI.modal.to-from)>=.4?' (flip-flop)':''}`;const ok=document.querySelector('[data-act="speechok"]');if(ok)ok.disabled=Math.abs(UI.modal.to-from)<.05;return;}
  const b=t.dataset.bind;if(!b||!UI.S)return;const parts=b.split('.');let o=UI.S;for(let i=0;i<parts.length-1;i++)o=o[parts[i]];
  let val=t.value;if(t.dataset.scale)val=+val/(+t.dataset.scale);else if(t.dataset.int||parts[parts.length-1]==='kids')val=+val;o[parts[parts.length-1]]=val;
  if(t.dataset.scale){const id=`lbl-${parts.slice(0,-1).join('-')}-${parts[parts.length-1]}`;const l=document.getElementById(id);if(l)l.textContent=posText(+parts[parts.length-1],val);}
  if(b==='bio.age'){const l=document.getElementById('lbl-age');if(l)l.textContent=val;}
  if(t.dataset.rerender)render();
});
function hoverState(a){if(UI.hover===a)return;UI.hover=a;const si=document.getElementById('stateinfo');if(si){if(!VIEW)buildView();si.innerHTML=stateInfo(a);}}
LISTEN('mouseover',e=>{const t=e.target.closest&&e.target.closest('[data-act="tile"]');if(!t||UI.screen!=='game')return;hoverState(t.dataset.v);});
LISTEN('focusin',e=>{const t=e.target.closest&&e.target.closest('[data-act="tile"]');if(!t||UI.screen!=='game')return;hoverState(t.dataset.v);});
LISTEN('keydown',e=>{if(e.key==='Escape'){if(UI.guide){UI.guide=null;render();}else if(UI.pending){UI.pending=null;render();}else if(UI.modal&&UI.modal.type==='coach'){UI.modal=null;render();}}});
/* ================= Multiplayer (versus) =================
 * Canonical multiplayer state stores human candidates as h0..h3 with per-player data in
 * G.seats. To run any existing single-player code for one human, activateSeat() renames
 * that human to 'P' and swaps their personal fields (plan, cash, secret, dialogs, RNG...)
 * onto G. deactivateSeat() puts everything back. The host replays each player's recorded
 * clicks with that player's own RNG stream, so results match what the player saw.
 */
const MP={lastReplay:{},on:false,log:[],seat:null,party:'D',room:'',onEndWeek:null,onSetupDone:null,onExit:null,waitingNames:[]};
const MP_REC=new Set(['action','unplan','staff','cancelpick','tile','evchoice','close','scandal','vet','vp','platform','speechok','oppotarget','oppogo','releasego','endorsego','string','debate','rebut','debnext','coach','coachadd','margeadd','margeplan']);
const SEAT_FIELDS=['plan','cash','staff','apWeek','prep','exposure','secret','secretState','flips','scandals','confessed','flags','dirt','strings','donorBlock','revealed','notes','debates','customParty','prevBloc','intern','released','releasedOn','minorAsked','usedQ','recentEv','trailedFinal','speech','scandalPending','recap','mq','usedEvents','bandit','recounted','unity','ballotDeadline'];
const HUMAN_QUOTES=['I’m not here to make promises. I’m here to make better promises.','My opponent has a plan. I have a better one, and also a slogan.','Let’s be honest: I’m the only one up here who reads the polls for fun.'];
function rk(o,f,t){if(o&&Object.prototype.hasOwnProperty.call(o,f)){o[t]=o[f];delete o[f];}}
function renameId(f,t){
  rk(G.cands,f,t);if(G.cands[t])G.cands[t].id=t;
  G.active=G.active.map(x=>x===f?t:x);
  rk(G.effort,f,t);rk(G.endorsed,f,t);
  [G.polls,G.prevPolls,G.pollBias,G.final].forEach(m=>{if(m)for(const a in m)rk(m[a],f,t);});
  [G.pollSum,G.finalSum].forEach(x=>{if(!x)return;rk(x.ev,f,t);rk(x.pop,f,t);for(const a in x.lead)if(x.lead[a].id===f)x.lead[a].id=t;});
  (G.pollHistory||[]).forEach(h=>{rk(h.sh,f,t);if(h.ev)rk(h.ev,f,t);});
}
function activateSeat(s){const st=G.seats[s];G._active=s;renameId(s,'P');SEAT_FIELDS.forEach(f=>{G[f]=st[f];});G._grng=G.rng;G.rng=st.rng;}
function deactivateSeat(){const s=G._active;if(!s)return;const st=G.seats[s];SEAT_FIELDS.forEach(f=>{st[f]=G[f];delete G[f];});st.rng=G.rng;G.rng=G._grng;delete G._grng;renameId('P',s);G._active=null;}
/** Run fn without touching this browser's screen, game, or recording state. */
function headless(fn){const saved={G,app,ui:{...UI},roster:ROSTER,on:MP.on,log:MP.log};app=null;MP.on=false;
  try{return fn();}finally{G=saved.G;app=saved.app;for(const k in UI)if(!(k in saved.ui))delete UI[k];Object.assign(UI,saved.ui);ROSTER=saved.roster;MP.on=saved.on;MP.log=saved.log;}}
function seedMix(seed,i){let h=(seed^Math.imul(i+1,0x9E3779B1))|0;h=Math.imul(h^(h>>>16),0x85EBCA6B);return (h^(h>>>13))|0;}
function newSeat(e,i,bg,S,cp,seed){
  return {uid:e.uid,name:e.name,plan:[],cash:20+(bg.cash||0),staff:'standard',apWeek:4,prep:S.bg==='cabinet'?1:0,
    exposure:S.secret==='none'?0:10,secret:S.secret==='none'?null:(S.secret==='random'?pick(SECRETS):SECRETS[+S.secret]),secretState:S.secret==='none'?'none':'hidden',
    flips:0,scandals:0,confessed:false,flags:{},dirt:{},strings:[],donorBlock:0,revealed:[],notes:[],debates:{won:0,lost:0,draw:0,total:0},customParty:cp,
    prevBloc:null,intern:pick(INTERN),released:false,releasedOn:[],minorAsked:[],usedQ:[],recentEv:[],usedEvents:[],mq:[],rng:seedMix(seed,i),ballotDeadline:G.pace==='quick'?3:4};
}
/** Host: build a new versus game from each player's finished setup. entries are in seat order. */
function createMulti(entries,settings,seed){return headless(()=>{
  const e0=entries[0];
  UI.S={...e0.setup,diff:settings.diff||'normal',pace:settings.pace||'standard',primaries:false,seed:seed|0};UI.mq=[];
  startGame();
  G.mp=true;G.humans=['h0'];G.seats={h0:{uid:e0.uid,name:e0.name}};
  const p0=G.cands.P;p0.quotes=HUMAN_QUOTES;p0.blurb='A player-run campaign.';p0.secret=G.secret||'Their campaign finances are a mess';
  G._active='h0';G._grng=G.rng;G.rng=seedMix(seed,0);G.mq=[{type:'vp',opts:vpOptions()}];
  deactivateSeat();
  entries.slice(1).forEach((e,j)=>{
    const i=j+1,id='h'+i,S={...e.setup},bg=BGS[S.bg];
    const stats=S.stats?{...S.stats}:{...bg.stats};if(S.perk==='silver')stats.deb=Math.min(6,stats.deb+1);
    let cp=null;
    const c={id,party:S.party,name:S.name.trim(),title:bg.title,home:S.home,pos:S.pos.slice(),stats,cred:bg.cred+(S.perk==='bipartisan'?3:0),mom:(bg.mom||0)*.5,bm:{},perk:S.perk,flaw:S.flaw,bg:S.bg,vp:null,pq:5,bio:{...S.bio},minor:{...S.minor},ebm:{},quotes:HUMAN_QUOTES,blurb:'A player-run campaign.'};
    if(S.party==='C'){cp={name:S.cp.name.trim(),color:S.cp.color,values:S.cp.values.slice(),base:S.cp.base.slice()};c.cp=cp;c.ballot={};ST_LIST.forEach(s=>{if(s.ev>=10||Math.abs(s.lean)<=4)c.ballot[s.a]=true;});}
    refreshStatic(c);G.cands[id]=c;
    const ai=S.party==='C'?null:G.active.find(x=>!isHumanId(x)&&G.cands[x].party===S.party);
    if(ai)G.active=G.active.map(x=>x===ai?id:x);else G.active.push(id);
    G.humans.push(id);
    const st=newSeat(e,i,bg,S,cp,seed);G.seats[id]=st;c.secret=st.secret||'Their campaign finances are a mess';
    tick(`${fullName(c)} enters the race${S.party==='C'?' for the '+cp.name:''}`);
    activateSeat(id);G.mq=[{type:'vp',opts:vpOptions()}];deactivateSeat();
  });
  computePolls();G.prevPolls=null;G.pollHistory=[{w:0,sh:{...G.pollSum.pop},ev:{...G.pollSum.ev}}];
  G.humans.forEach(s=>{activateSeat(s);G.prevBloc=blocSupport();deactivateSeat();});
  return G;
});}
function replayInput(ai,val){if(!UI.modal)return;if(ai==='speechi'){UI.modal.i=+val;UI.modal.to=P().pos[+val];}if(ai==='speechto')UI.modal.to=+val/50;}
function seatWeekly(notes){
  const c=P();
  if(c.flaw==='workaholic'){if(G.secretState==='hidden')G.exposure=clamp(G.exposure+3,0,100);if(rnd()<.08){c.mom=clamp(c.mom-2,-10,10);notes.push('You burned out and slept through a rally. Momentum −2.');}}
  if(G.pollSum){const top=Object.entries(G.pollSum.pop).filter(([id])=>id!=='P').sort((a,b)=>b[1]-a[1])[0];if(top&&top[1]-G.pollSum.pop.P>.04){const b={easy:1.2,normal:.9,hard:.6}[G.diff];c.mom=clamp(c.mom+b,-10,10);notes.push(`Underdog energy: volunteers rally to your campaign. Momentum +${b}.`);}}
  if(c.perk==='comeback'&&G.pollSum){const top=Object.entries(G.pollSum.pop).sort((a,b)=>b[1]-a[1])[0][0];if(top!=='P'){c.mom=clamp(c.mom+1.2,-10,10);notes.push('Comeback kid: trailing fires you up. Momentum +1.2.');}}
  if(G.secretState==='hidden'){let lead=0;if(G.pollSum){const top=Object.entries(G.pollSum.pop).sort((a,b)=>b[1]-a[1])[0][0];lead=top==='P'?3:0;}
    const inc=(3+lead+{easy:0,normal:1,hard:3}[G.diff]+{easy:1,normal:3,hard:5}[G.diff])*(c.perk==='teflon'?.6:1);G.exposure=clamp(G.exposure+inc,0,100);
    if(G.exposure>=100)G.scandalPending=true;else if(G.exposure>=75)notes.push(`Warning: your secret is at ${Math.round(G.exposure)}% exposure.`);}
}
/** Host: resolve one week. logs = { seatId: { log: [...clicks], plan: [...] } }. Returns the next state. */
function resolveMulti(state,logs){return headless(()=>{
  const orig=JSON.stringify(state);const fresh=()=>{G=JSON.parse(orig);ROSTER=G.roster||[];};
  // 1. Replay each player's clicks against the SAME snapshot they saw, so dialog outcomes match exactly.
  const res={};
  JSON.parse(orig).humans.forEach(s=>{
    fresh();
    const others={};G.active.forEach(id=>{if(id!==s)others[id]={mom:G.cands[id].mom,cred:G.cands[id].cred};});
    const mood0=G.mood||0;TICK_CAP=[];
    activateSeat(s);
    UI.screen='game';UI.mq=(G.mq||[]).slice();UI.modal=UI.mq.shift()||null;UI.pending=null;UI.flash='';UI.guide=null;
    const sub=logs[s]||{};
    (sub.log||[]).forEach(e=>{try{if(e.act.indexOf('in:')===0)replayInput(e.act.slice(3),e.v);else handleAct(e.act,e.v,{k:e.k});}catch(err){}});
    MP.lastReplay[s]={cred:P().cred,pos:P().pos.slice(),cash:G.cash,mom:P().mom};
    G.plan=(sub.plan||[]).map(x=>({...x}));
    deactivateSeat();
    const od={};for(const id in others){const c=G.cands[id];if(!c)continue;const dm=c.mom-others[id].mom,dc=c.cred-others[id].cred;if(dm||dc)od[id]={mom:dm,cred:dc};}
    res[s]={seat:G.seats[s],cand:G.cands[s],effort:G.effort[s],endorsed:G.endorsed[s],od,mood:(G.mood||0)-mood0,ticks:TICK_CAP};
    TICK_CAP=null;
  });
  // 2. Merge everyone's results into one state.
  fresh();
  G.humans.forEach(s=>{const r=res[s];G.seats[s]=r.seat;G.cands[s]=r.cand;if(r.effort)G.effort[s]=r.effort;if(r.endorsed)G.endorsed[s]=r.endorsed;
    for(const id in r.od){const c=G.cands[id];c.mom=clamp(c.mom+r.od[id].mom,-10,10);c.cred=clamp(c.cred+r.od[id].cred,0,100);}
    G.mood=(G.mood||0)+r.mood;G.ticker=r.ticks.slice().reverse().concat(G.ticker).slice(0,14);});
  // 3. The host runs everyone's plans, in seat order.
  const ctx={};
  G.humans.forEach(s=>{activateSeat(s);ctx[s]={before:snapshot(),notes:(G.notes||[]).concat(executePlan())};deactivateSeat();});
  const ai=aiTurn();decayAll();G.turn=(G.turn||0)+1;
  G.mood=(G.mood||0)*.85+gauss()*.6;ST_LIST.forEach(st=>{G.drift[st.a]=(G.drift[st.a]||0)*.9+gauss()*.7;});
  G.humans.forEach(s=>{activateSeat(s);seatWeekly(ctx[s].notes);deactivateSeat();});
  G.prevPolls=G.polls;computePolls();G.pollHistory.push({w:G.week,sh:{...G.pollSum.pop},ev:{...G.pollSum.ev}});
  const lead=Object.entries(G.pollSum.pop).sort((a,b)=>b[1]-a[1]);
  tick(`New national poll: ${G.cands[lead[0][0]].name} ${pct(lead[0][1])}%, ${G.cands[lead[1][0]].name} ${pct(lead[1][1])}%`);
  G.humans.forEach(s=>{activateSeat(s);const after=snapshot();
    if(P().party==='C'&&G.week===G.ballotDeadline)ctx[s].notes.push(`The ballot deadline has passed. You’re on the ballot in ${Object.keys(P().ballot||{}).length} states.`);
    const r=buildRecap(ctx[s].before,after,ctx[s].notes,{log:ai.log,attacks:ai.attacks.filter(x=>x.tgt===s)});
    r.news=(G.news||[]).slice();r.mood=G.mood;r.week=G.week;G.recap=r;G.prevBloc=after.bloc;
    if(G.week>=G.weeks)G.trailedFinal=lead[0][0]!==s;
    deactivateSeat();});
  G.news=[];G.week++;
  if(G.week>G.weeks){const f=project(1.5,1.5);G.final=f;G.finalSum=summarize(f);G.mpFinal=true;G.phase='night';}
  else G.humans.forEach(s=>{activateSeat(s);UI.mq=[];UI.modal=null;weekStart();G.mq=[UI.modal,...UI.mq].filter(Boolean);deactivateSeat();});
  return G;
});}
/** Client: show the shared state from this player's seat. */
function mpLoad(state,seat){
  G=JSON.parse(JSON.stringify(state));ROSTER=G.roster||[];activateSeat(seat);MP.seat=seat;MP.log=[];
  UI.waiting=false;UI.pending=null;UI.flash='';UI.guide=null;UI.tut=null;UI.tutOffer=false;
  if(G.phase==='night'){startNight();return;}
  UI.screen='game';UI.mq=(G.mq||[]).slice();
  if(G.recap&&G.week>1)UI.mq.unshift({type:'recap',recap:G.recap,title:`Week ${G.recap.week} recap`});
  UI.modal=UI.mq.shift()||null;render();
}
function mpIntercept(act,v,ds){
  if(act==='endweek'){if(UI.modal||UI.waiting)return true;UI.waiting=true;const payload=JSON.parse(JSON.stringify({log:MP.log,plan:G.plan||[]}));MP.log=[];render();if(MP.onEndWeek)MP.onEndWeek(payload);return true;}
  if(['quit','new','title','loadslot','continue','tutyes'].includes(act)){if(UI.screen==='results'&&MP.onExit)MP.onExit();return true;}
  if(act==='party'&&v!==MP.party)return true;
  if(act==='next'&&UI.screen==='setup'&&UI.S.step===5){const S=UI.S;if(Object.keys(S.minor).length<3){S.err='Pick at least 3 minor issues to campaign on.';render();return true;}
    UI.screen='mpwait';render();if(MP.onSetupDone)MP.onSetupDone(JSON.parse(JSON.stringify(S)));return true;}
  if(MP_REC.has(act)&&UI.screen==='game'&&!(UI.modal&&UI.modal.type==='recap')){const e={act};if(v!==undefined)e.v=v;if(ds.k!==undefined)e.k=ds.k;MP.log.push(e);}
  return false;
}
function mpWaitHTML(){return `<div class="title-screen"><div class="title-card"><div class="brand">Politicaster</div><h1 style="font-size:56px">Campaign announced</h1>
  <p class="muted">Waiting for the other candidates to finish building their campaigns${MP.waitingNames.length?': '+MP.waitingNames.map(esc).join(', '):''}.</p></div></div>`;}
function mpWaitingOverlay(){return `<div class="overlay center" role="status"><div class="lt"><div class="lt-head"><div class="tag">Week submitted</div><h2>Waiting for the other candidates</h2></div><div class="lt-body">
  <p>${MP.waitingNames.length?'Still planning: '+MP.waitingNames.map(esc).join(', ')+'.':'Everyone is in. The week is being resolved…'}</p><p class="muted">Your plan is locked in. The recap appears as soon as the host resolves the week.</p></div></div></div>`;}

export function mountGame(el,opts){
  app=el;SHELL.onMultiplayer=(opts&&opts.onMultiplayer)||null;
  const mp=opts&&opts.mp;MP.on=!!mp;if(mp)Object.assign(MP,{party:mp.party||'D',room:mp.room||'',onEndWeek:mp.onEndWeek||null,onSetupDone:mp.onSetupDone||null,onExit:mp.onExit||null,log:[]});
  LISTENERS.forEach(([t,f])=>(t==='keydown'?window:el).addEventListener(t,f));
  UI.mapMode=store.get('politicaster.mapmode')||'tiles';const t=store.get('politicaster.theme');if(t)document.documentElement.dataset.theme=t;
  UI.screen=mp?'mpwait':'title';render();
}
export function unmountGame(){
  if(!app)return;LISTENERS.forEach(([t,f])=>(t==='keydown'?window:app).removeEventListener(t,f));app.innerHTML='';app=null;
}
// Headless engine access for tests, balance sims, and the multiplayer host.
export const Legacy={
  get G(){return G;},set G(v){G=v;ROSTER=(v&&v.roster)||[];},UI,
  newSetup,startGame,beginGeneral,weekStart,endWeek,showNext,margePlanWeek,addPlan,removePlan,applyFx,
  platformFight,platformChoice,stringChoice,scandalChoice,answerDebate,rebutDebate,nextDebate,afterPrimaryResults,
  computePolls,project,summarize,decideWinner,finish,isPrimary,P:()=>G.cands.P,
  mp:{
    createMulti,resolveMulti,load:mpLoad,act:handleAct,lastReplay:()=>MP.lastReplay,
    configure(o){Object.assign(MP,o);},
    startSetup(party,room){MP.party=party;if(room)MP.room=room;const S=newSetup();S.party=party;S.pos=party==='C'?S.cp.values.slice():DEF[party].slice();UI.S=S;UI.screen='setup';render();},
    setWaiting(names){MP.waitingNames=names||[];if(app&&(UI.screen==='mpwait'||UI.waiting))render();},
    showWaitScreen(){UI.screen='mpwait';render();},
  },
};
