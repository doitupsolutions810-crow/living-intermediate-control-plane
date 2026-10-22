import fs from 'node:fs';
import path from 'node:path';
import { softContract, heat, hypothesisReport, FIXED } from './great-scale-research.mjs';

export class DescentEngine {
  constructor(opts = {}){
    this.x = opts.start ?? 1.0;
    this.k = opts.k ?? 0.5;
    this.tickMs = opts.tickMs ?? 150;
    this.stateDir = opts.stateDir ?? path.join(process.cwd(), 'state');
    this.stateFile = path.join(this.stateDir, 'descent-engine.json');
    this._timer = null;
    this.history = [];
    this.stepCount = 0;
    this.load();
  }
  load(){
    try{
      if (fs.existsSync(this.stateFile)){
        const j = JSON.parse(fs.readFileSync(this.stateFile,'utf8'));
        this.x = j.x ?? this.x; this.k = j.k ?? this.k;
        this.stepCount = j.stepCount ?? 0;
        this.history = Array.isArray(j.history) ? j.history.slice(-200) : [];
      }
    }catch{}}
  save(){
    try{
      fs.mkdirSync(this.stateDir, {recursive:true});
      fs.writeFileSync(this.stateFile, JSON.stringify({ x:this.x, k:this.k, stepCount:this.stepCount, history:this.history.slice(-200), savedAt:new Date().toISOString() },null,2));
    }catch{}}
  tick(){
    this.x = softContract(this.x, this.k);
    this.stepCount++;
    const h = { t:this.stepCount, x:this.x, S:heat(this.x/9), hyp:hypothesisReport(this.x).support };
    this.history.push(h);
    if (this.history.length > 500) this.history.shift();
    if (this.stepCount % 20 === 0) this.save();
    return h;
  }
  start(){ if(this._timer) return; this._timer = setInterval(()=>this.tick(), this.tickMs); this._timer.unref?.(); }
  stop(){ if(this._timer){ clearInterval(this._timer); this._timer=null; } this.save(); }
  reset(start=1.0){ this.x = start; this.stepCount = 0; this.history=[]; this.save(); }
  state(){ return { x:this.x, k:this.k, stepCount:this.stepCount, last:this.history.at(-1)??null, running:!!this._timer }; }
}
export default DescentEngine;
