const $ = (id) => document.getElementById(id);
const typeNames = {appearance:"Appearance",entity:"Entity",image_formation:"Image Formation",correspondence:"Correspondence"};
const modeNames = {direct:"D",reflection:"R",through_glass:"T"};
const colors = {direct:"#1875ad",reflection:"#d16d2d",through_glass:"#178569"};
let data, exampleIndex=0, selectedEntity=null, metric="Score", selectedName="";
function textNode(tag,text,className){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function svgNode(tag,attributes){const el=document.createElementNS("http://www.w3.org/2000/svg",tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);return el;}

function renderExample(index){
  exampleIndex=index;selectedEntity=null;
  const e=data.examples[index];
  $("example-title").textContent=e.title;
  $("example-description").textContent=e.description;
  $("example-description").hidden=!e.description;
  $("example-image").src=e.image;
  $("example-image").alt=e.title+" from the paper supplementary material";
  document.querySelectorAll("[data-example]").forEach(b=>{b.classList.toggle("active",Number(b.dataset.example)===index);b.setAttribute("aria-pressed",String(Number(b.dataset.example)===index));});
  $("example-questions").replaceChildren();
  $("qa-count").textContent=e.questions.length+" questions · full group";
  for(const q of e.questions){
    const item=textNode("div","","qa-item"),copy=textNode("div","");
    copy.append(textNode("span",typeNames[q.question_type],"qa-type"),textNode("p",q.question,"qa-question"));
    item.append(copy,textNode("strong",q.answer,"qa-answer"));$("example-questions").append(item);
  }
  $("example-questions").scrollTop=0;
  const counts={direct:0,reflection:0,through_glass:0};
  e.appearances.forEach(p=>{p.displayLabel=modeNames[p.mode]+(++counts[p.mode]);});
  renderAnnotations();
}
function renderAnnotations(){
  const e=data.examples[exampleIndex],svg=$("annotation-overlay");
  svg.replaceChildren();svg.setAttribute("viewBox","0 0 "+e.width+" "+e.height);
  svg.style.visibility=$("show-annotations").checked?"visible":"hidden";
  const groups=Object.groupBy?Object.groupBy(e.appearances,p=>p.entity_id):e.appearances.reduce((a,p)=>{(a[p.entity_id]??=[]).push(p);return a;},{});
  const size=e.width/65;
  for(const [id,points] of Object.entries(groups)){
    if(selectedEntity&&selectedEntity!==id)continue;
    const first=points[0];
    points.slice(1).forEach(p=>{const line=svgNode("line",{x1:first.x*e.width,y1:first.y*e.height,x2:p.x*e.width,y2:p.y*e.height,class:"annotation-edge"});line.style.strokeWidth=size*.18;svg.append(line);});
  }
  e.appearances.forEach(p=>{
    const g=svgNode("g",{class:"annotation-point",role:"button",tabindex:"0","aria-label":p.displayLabel+", entity "+Number(p.entity_id.slice(1))});
    g.style.opacity=selectedEntity&&selectedEntity!==p.entity_id?".24":"1";
    const circle=svgNode("circle",{cx:p.x*e.width,cy:p.y*e.height,r:size,fill:colors[p.mode]});circle.style.strokeWidth=size*.14;
    const label=svgNode("text",{x:p.x*e.width,y:p.y*e.height,"font-size":size*.83});label.textContent=p.displayLabel;
    const select=()=>{selectedEntity=selectedEntity===p.entity_id?null:p.entity_id;renderAnnotations();};
    g.addEventListener("click",select);g.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();select();}});
    g.append(circle,label);svg.append(g);
  });
  $("entity-groups").replaceChildren();
  for(const [id,points] of Object.entries(groups)){
    const button=textNode("button","Entity "+Number(id.slice(1))+": "+points.map(p=>p.displayLabel).join(" · "),"entity-group"+(selectedEntity===id?" active":""));
    button.type="button";button.addEventListener("click",()=>{selectedEntity=selectedEntity===id?null:id;renderAnnotations();});$("entity-groups").append(button);
  }
  const entityCount=Object.keys(groups).length;
  $("identity-note").textContent=selectedEntity?"Entity "+Number(selectedEntity.slice(1))+" → "+groups[selectedEntity].map(p=>p.displayLabel).join(", "):e.appearances.length+" appearances · "+entityCount+(entityCount===1?" physical entity.":" physical entities.")+" Lines connect appearances of the same entity.";
}
function drawResults(){
  const lower=metric.includes("NAE"),search=$("model-search").value.toLowerCase();
  const models=data.models.filter(m=>m.name.toLowerCase().includes(search)).sort((a,b)=>lower?a[metric]-b[metric]:b[metric]-a[metric]);
  const maximum=metric==="Score"?40:100;
  $("model-count").textContent=models.length+" / 40 models";
  $("axis-ticks").replaceChildren(...[0,maximum/4,maximum/2,maximum*3/4,maximum].map(v=>textNode("span",v)));
  $("model-bars").replaceChildren();
  models.forEach(m=>{
    const row=textNode("button","","model-row"+(m.name===selectedName?" selected":""));row.type="button";
    row.setAttribute("aria-label",m.name+", "+metric+" "+m[metric].toFixed(2));row.title=m.name;
    const name=textNode("span",m.name,"model-name"),track=textNode("span","","bar-track"),fill=textNode("span","","bar-fill"),value=textNode("span",m[metric].toFixed(2),"bar-value");
    fill.style.width=(m[metric]/maximum*100)+"%";value.style.left="calc("+m[metric]/maximum*100+"% - "+m[metric]/maximum*38+"px + 7px)";
    track.append(fill,value);row.append(name,track);row.addEventListener("click",()=>{selectedName=m.name;drawResults();drawDetail();});$("model-bars").append(row);
  });
  document.querySelectorAll("[data-metric]").forEach(b=>{b.classList.toggle("active",b.dataset.metric===metric);b.setAttribute("aria-pressed",String(b.dataset.metric===metric));});
}
function drawDetail(){
  const m=data.models.find(m=>m.name===selectedName);$("selected-model").textContent=m.name;
  $("selected-aggregate").replaceChildren(...["Score","Group-Acc","Phys-Gnd"].map(key=>{const el=textNode("div","","aggregate-value");el.append(textNode("span",key),textNode("strong",m[key].toFixed(2)));return el;}));
  $("selected-errors").replaceChildren();
  [["A","Appearance"],["E","Entity"],["I","Image formation"],["C","Correspondence"]].forEach(([key,name])=>{
    const item=textNode("div","","error-profile"),heading=textNode("div","");
    heading.append(textNode("span",name),textNode("strong",m[key+"-NAE"].toFixed(2)+" NAE"));
    const svg=svgNode("svg",{viewBox:"0 0 100 10",preserveAspectRatio:"none","aria-label":name+" NAE "+m[key+"-NAE"]});
    svg.append(svgNode("rect",{x:0,y:3,width:100,height:3,fill:"#e2e7ec"}),svgNode("rect",{x:0,y:3,width:m[key+"-NAE"],height:3,fill:"#7894ae"}));
    item.append(heading,svg,textNode("div","MAE "+m[key+"-MAE"].toFixed(3),"raw-mae"));$("selected-errors").append(item);
  });
}
async function initialize(){
  const response=await fetch("benchmark.json");if(!response.ok)throw Error("Unable to load benchmark results");
  data=await response.json();
  data.examples.forEach((e,i)=>{const button=textNode("button",e.target);button.type="button";button.dataset.example=i;button.addEventListener("click",()=>renderExample(i));$("example-tabs").append(button);});
  $("show-annotations").addEventListener("change",renderAnnotations);
  document.querySelectorAll("[data-metric]").forEach(b=>b.addEventListener("click",()=>{metric=b.dataset.metric;drawResults();}));
  $("model-search").addEventListener("input",drawResults);
  selectedName=data.models[0].name;renderExample(0);drawResults();drawDetail();
}
initialize().catch(error=>{$("example-title").textContent="Unable to load examples. Please refresh the page.";console.error(error);});
$("copy-citation").addEventListener("click",async event=>{try{await navigator.clipboard.writeText($("bibtex").textContent);event.target.textContent="Copied";}catch{event.target.textContent="Select text to copy";}});
