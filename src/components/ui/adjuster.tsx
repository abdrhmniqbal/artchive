import * as React from "react"
import { cva } from "class-variance-authority"
import { DOMAIN, FLOW_CHARACTERS, PRODUCT_CATEGORIES, getSettingsSnapshot, getServerSettingsSnapshot, subscribeSettings, setMotionMode, setMotionCategory, setFlowSettings, resetFlow, setMorphConfig, setMorphTier, resetMorph, exportMorphJSON, importMorphJSON, type MorphConfig, type Tier, type TierName, type FlowVariant } from "@/lib/cojeev-motion/settings"
import { useMorph } from "@/lib/cojeev-motion/use-morph"
import { useFlowPress } from "@/lib/cojeev-motion/flow-press"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { CopyButton } from "@/components/ui/code-block"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BodySecondary, Meta } from "@/components/ui/typography"

const adjusterVariants=cva([
 "v-adjuster @container box-border w-full max-w-[680px] rounded-[var(--r-card)] border border-[var(--v-border)] bg-[var(--v-canvas)] font-[family-name:var(--font-text)] text-[13px] leading-[1.5] text-[var(--v-text)]",
 "[&_h2]:m-0 [&_h2]:font-[family-name:var(--font-display)] [&_h2]:text-[20px] [&_p]:mt-1 [&_p]:mb-3 [&_p]:text-[var(--v-text-2)]",
 "[&_fieldset]:mb-5 [&_fieldset]:min-w-0 [&_fieldset]:rounded-[var(--r-md)] [&_fieldset]:border [&_fieldset]:border-[var(--v-border)] [&_fieldset]:p-4 [&_legend]:px-[5px] [&_legend]:font-[650]",
 "[&_input]:accent-[var(--v-pink)] [&_textarea]:mt-2 [&_textarea]:resize-y [&_textarea]:font-mono",
 "[&_button]:cursor-pointer [&_button]:rounded-[var(--r-pill)] [&_button]:border [&_button]:border-[var(--v-border)] [&_button]:bg-[var(--v-beige)] [&_button]:px-3 [&_button]:py-2 [&_button]:text-[var(--v-ink)]",
 "[&_details]:mb-5 [&_summary]:cursor-pointer [&_summary]:py-[10px] [&_summary]:font-[650]",
 "[&_input:focus-visible]:outline-2 [&_input:focus-visible]:outline-offset-3 [&_input:focus-visible]:outline-[var(--v-pink)] [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-3 [&_button:focus-visible]:outline-[var(--v-pink)] [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-offset-3 [&_select:focus-visible]:outline-[var(--v-pink)] [&_textarea:focus-visible]:outline-2 [&_textarea:focus-visible]:outline-offset-3 [&_textarea:focus-visible]:outline-[var(--v-pink)] [&_summary:focus-visible]:outline-2 [&_summary:focus-visible]:outline-offset-3 [&_summary:focus-visible]:outline-[var(--v-pink)]",
])
const fieldVariants=cva("box-border min-w-0 w-full rounded-[var(--r-sm)] border border-[var(--v-border)] bg-[var(--v-canvas)] px-[9px] py-[7px] text-[var(--v-text)]")
export type AdjusterProps=React.ComponentProps<'section'> & {defaultOpen?:boolean}
export type MotionControlsProps = React.ComponentProps<'section'> & { showPreview?: boolean }
const CHARACTER_DESCRIPTIONS:Record<Exclude<FlowVariant,'off'>,string> = {
 glide:'A smooth, direct slide for everyday interfaces.',
 stretch:'An elastic stretch that follows the selection.',
 jelly:'A soft, playful wobble as the selection lands.',
 comet:'A quick movement with a trailing accent.',
 drop:'An ink-like gather, movement and soft landing.',
 rubber:'A flexible pull between neighbouring choices.',
 pebble:'A rounded shape with a gentle rolling feel.',
 ripple:'A moving selection with a ripple on arrival.',
 halo:'A subtle glow around the selected item.',
}
function subscribeReducedMotion(listener:()=>void) {
 const media=window.matchMedia('(prefers-reduced-motion: reduce)')
 media.addEventListener('change',listener)
 return ()=>media.removeEventListener('change',listener)
}
function readReducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches }
/** Compact shared selection controls. Changes persist in the site's motion settings. */
export function MotionControls({showPreview=true,className,...props}:MotionControlsProps) {
 const {motion,flow}=React.useSyncExternalStore(subscribeSettings,getSettingsSnapshot,getServerSettingsSnapshot)
 const reduced=React.useSyncExternalStore(subscribeReducedMotion,readReducedMotion,()=>false)
 const id=React.useId()
 const [preview,setPreview]=React.useState('overview')
 const enabled=motion.mode!=='off'&&flow.variant!=='off'
 const enable=(next:boolean)=>{setMotionMode(next?'subtle':'off');if(next&&flow.variant==='off')setFlowSettings({variant:'glide'})}
 const reset=()=>{setMotionMode('subtle');resetFlow()}
 return <section data-slot="motion-controls" className={cn('v-motion-controls',className)} {...props}>
  <div className="v-motion-controls__row">
   <div><Label htmlFor={id+'-enabled'}>Enable motion</Label><Meta>Changes apply across this site.</Meta></div>
   <Switch id={id+'-enabled'} checked={enabled} onCheckedChange={enable}/>
  </div>
  {reduced&&<BodySecondary role="status">Your device prefers reduced motion. Selections stay still; your chosen settings are saved.</BodySecondary>}
  <div className="v-motion-controls__section">
   <Label id={id+'-characters'}>Choose a character</Label>
   <div className="v-motion-controls__characters" role="group" aria-labelledby={id+'-characters'}>
    {(Object.entries(FLOW_CHARACTERS) as [FlowVariant,typeof FLOW_CHARACTERS[FlowVariant]][]).filter(([value])=>value!=='off').map(([value,character])=><Button key={value} size="sm" variant={flow.variant===value?'default':'secondary'} aria-pressed={flow.variant===value} onClick={()=>setFlowSettings({variant:value})}>{character.label}</Button>)}
   </div>
   <BodySecondary className="v-motion-controls__description">{flow.variant==='off'?'Selection motion is paused. Choose a character to resume.':CHARACTER_DESCRIPTIONS[flow.variant]}</BodySecondary>
  </div>
  {showPreview&&<div className="v-motion-controls__preview">
   <div className="v-motion-controls__row"><Meta>Try the movement</Meta><Button size="sm" variant="ghost" onClick={()=>setPreview(current=>current==='overview'?'activity':current==='activity'?'settings':'overview')}><Icon name="refresh" size="sm"/>Replay selection motion</Button></div>
   {!enabled&&<Meta>Motion is off. Enable it above to see the movement; tab selection still works.</Meta>}
   <Tabs value={preview} onValueChange={setPreview} variant="pills">
    <TabsList aria-label="Motion preview"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList>
    <TabsContent value="overview"><BodySecondary>Choose another tab to see {flow.variant==='off'?'the selection':FLOW_CHARACTERS[flow.variant].label.toLowerCase()} in action.</BodySecondary></TabsContent>
    <TabsContent value="activity"><BodySecondary>Try switching back quickly. The indicator follows your latest choice.</BodySecondary></TabsContent>
    <TabsContent value="settings"><BodySecondary>Keep the character you like, then adjust its speed and intensity below.</BodySecondary></TabsContent>
   </Tabs>
  </div>}
  <div className="v-motion-controls__section">
   <div className="v-motion-controls__row"><Label id={id+'-speed'}>Speed</Label><Meta>{flow.speed.toFixed(2)}×</Meta></div>
   <Slider aria-labelledby={id+'-speed'} thumbLabel="Motion speed" min={.25} max={Math.max(3,flow.speed)} step={.05} value={[flow.speed]} onValueChange={([speed])=>setFlowSettings({speed})}/>
  </div>
  <div className="v-motion-controls__section">
   <div className="v-motion-controls__row"><Label id={id+'-intensity'}>Intensity</Label><Meta>{flow.intensity.toFixed(2)}×</Meta></div>
   <Slider aria-labelledby={id+'-intensity'} thumbLabel="Motion intensity" disabled={flow.variant==='glide'||flow.variant==='off'} aria-describedby={id+'-intensity-note'} min={0} max={Math.max(2,flow.intensity)} step={.05} value={[flow.intensity]} onValueChange={([intensity])=>setFlowSettings({intensity})}/>
   <Meta id={id+'-intensity-note'}>{flow.variant==='glide'?'Glide stays calm. Choose an expressive character to tune intensity.':'Shapes the stretch, ripple or glow of expressive characters.'}</Meta>
  </div>
  <div className="v-motion-controls__row"><div><Label htmlFor={id+'-hover'}>Pointer preview</Label><Meta>A hint before you select. Pointer devices only.</Meta></div><Switch id={id+'-hover'} checked={flow.hover} onCheckedChange={hover=>setFlowSettings({hover})}/></div>
  <div className="v-motion-controls__section">
   <div className="v-motion-controls__row"><Label id={id+'-ghost-strength'}>Pointer preview strength</Label><Meta>{flow.hoverStrength.toFixed(2)}×</Meta></div>
   <Slider aria-labelledby={id+'-ghost-strength'} thumbLabel="Pointer preview strength" disabled={!flow.hover} min={0} max={Math.max(2,flow.hoverStrength)} step={.05} value={[flow.hoverStrength]} onValueChange={([hoverStrength])=>setFlowSettings({hoverStrength})}/>
   <Meta>{!flow.hover?'Pointer preview is off.':flow.hoverStrength===0?'Strength is zero, so the pointer preview is invisible. Increase it to see the hint.':'Hover an unselected tab in the preview to see its surface.'}</Meta>
  </div>
  <div className="v-motion-controls__row">
   <Button variant="ghost" size="sm" onClick={reset}>Reset motion settings</Button>
   <CopyButton code={`import { setMotionMode, setFlowSettings } from "@/lib/cojeev-motion/settings";\n\nsetMotionMode(${JSON.stringify(motion.mode)});\nsetFlowSettings(${JSON.stringify(flow,null,2)});`}>Copy selection settings</CopyButton>
  </div>
 </section>
}
type Control=[label:string,min:number,max:number,step:number,unit:string]
const BEHAVIORS={rest:'Rest breath',reach:'Reach',merge:'Merge on entry',hold:'Hold inside',jiggleOn:'Let-go wobble',press:'Press squash',echo:'Outline echo'} as const
const CONFIG:Partial<Record<keyof MorphConfig,Control>>={
 lobeK:['Reach speed',20,320,5,''],lobeZ:['Reach bounce',.3,1.4,.02,'ζ'],mergeZ:['Merge bounce',.2,1.2,.02,'ζ'],arcK:['Slide-along speed',5,140,1,''],holdK:['Hold follow speed',10,220,5,''],pressK:['Release speed',40,320,5,''],jiggle:['Let-go wobble',0,1.5,.05,'×reach'],jiggleDecay:['Wobble fade',.4,4,.05,'/s'],curve:['Approach easing',.4,2,.05,''],quality:['Smoothness',1,6,.25,'px/pt'],grain:['Grain',0,.4,.01,''],sheen:['Sheen',0,1.5,.05,''],restSpeed:['Breath speed',0,3,.05,'×'],drift:['Arm drift',0,3,.05,'×'],dots:['Satellite dots',0,6,1,''],echoOff:['Echo distance',0,20,.5,'px'],echoScale:['Echo size',.9,1.2,.005,'×'],
}
const TIERS:Record<TierName,string>={pill:'Pill — buttons and selects',tile:'Tile — icon disks and badges',nav:'Nav — navigation rows and tabs',card:'Card — cards and panels',blob:'Blob — decorative shapes',spinner:'Spinner — loaders'}
const TIER_CONTROLS:Record<keyof Tier,Control>={
 reach:['Reach',0,24,.5,'px'],inside:['Hold bump',0,12,.1,'px'],press:['Press squash',0,12,.1,'%'],amp:['Rest breath',0,3,.01,'%'],R:['Sensing distance',0,240,2,'px'],sig:['Lobe width',1,120,1,'px'],lobes:['Arms',0,24,1,''],depth:['Arm length',0,.4,.005,'×'],asym:['Irregularity',0,1,.02,''],spread:['Arm thickness',.15,1.2,.01,'×'],
}
function Range({control,value,onChange}:{control:Control;value:number;onChange:(value:number)=>void}){
 const id=React.useId(),[label,min,max,step,unit]=control
 // Expand a convenient slider extent to represent authored values without writing a clamped value on mount.
 const low=Math.min(min,value),high=Math.max(max,value)
 return <div data-part="control" className="my-3 min-w-0 [&_label]:flex [&_label]:justify-between [&_label]:gap-2 [&_label_span]:text-[var(--v-text-2)]"><label htmlFor={id}>{label}<span>{unit}</span></label><div data-part="control-inputs" className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-3"><input id={id} type="range" className="m-0 min-w-0 w-full" min={low} max={high} step={step} value={value} disabled={low===high} onChange={event=>onChange(Number(event.currentTarget.value))}/><input type="number" className={fieldVariants()} aria-label={`${label} value${unit?' in '+unit:''}`} min={min} step={step} value={Number(value.toFixed(6))} onChange={event=>{if(event.currentTarget.value!==''&&Number.isFinite(event.currentTarget.valueAsNumber))onChange(event.currentTarget.valueAsNumber)}}/></div></div>
}
function Preview({tier}:{tier:TierName}){
 const press=useFlowPress<HTMLButtonElement>(),ref=useMorph<HTMLButtonElement>('buttons',press)
 return <div data-part="preview" className="grid justify-items-center gap-4 px-3 py-7 [&_span]:text-center [&_span]:text-[var(--v-text-2)]"><button ref={ref} type="button" data-slot="adjuster-preview" className="v-btn v-alive relative min-h-11 rounded-full bg-[var(--v-pink)] px-6 py-3" data-morph="fill" data-tier={tier}>Try this body</button><span>Move toward it, focus it, or press it.</span></div>
}
/** An optional front end to the shared motion engines. No panel settings are persisted. */
export function Adjuster({defaultOpen=true,className,...props}:AdjusterProps){
 const snapshot=React.useSyncExternalStore(subscribeSettings,getSettingsSnapshot,getServerSettingsSnapshot)
 const [open,setOpen]=React.useState(defaultOpen),[tier,setTier]=React.useState<TierName>('pill'),[text,setText]=React.useState(''),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('')
 const id=React.useId(),{motion,flow,profile,authored}=snapshot
 const importProfile=()=>{try{importMorphJSON(text);setError('');setNotice('Profile imported. Changes are live.')}catch(cause){setError(cause instanceof Error?cause.message:'Could not import the profile.');setNotice('')}}
 return <section data-slot="adjuster" className={adjusterVariants({className})} {...props}>
  <header data-part="header" className="flex items-center justify-between gap-4 p-5"><div><h2>Motion adjuster</h2><p>{authored?'Authored profile':'Shipped runtime profile'}</p></div><button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>{open?'Close':'Open'}</button></header>
  <div id={id} hidden={!open} data-part="body" className="px-5 pb-5">
   <fieldset><legend>Motion</legend><div data-part="choices" className="my-2 flex flex-wrap gap-x-4 gap-y-3 [&_label]:inline-flex [&_label]:items-center [&_label]:gap-[7px]">{(['off','subtle'] as const).map(mode=><label key={mode}><input type="radio" name={id+'-mode'} checked={motion.mode===mode} onChange={()=>setMotionMode(mode)}/>{mode==='off'?'Off':'Subtle'}</label>)}</div>
    <div data-part="choices" className="my-2 flex flex-wrap gap-x-4 gap-y-3 [&_label]:inline-flex [&_label]:items-center [&_label]:gap-[7px]">{PRODUCT_CATEGORIES.map(category=><label key={category}><input type="checkbox" checked={motion.cats[category]} onChange={event=>setMotionCategory(category,event.currentTarget.checked)}/>{category.charAt(0).toUpperCase()+category.slice(1)}</label>)}</div>
   </fieldset>
   <fieldset><legend>Selection</legend><label data-part="select-label" className="mb-3 grid gap-[6px]">Character<select className={fieldVariants()} value={flow.variant} onChange={event=>setFlowSettings({variant:event.currentTarget.value as FlowVariant})}>{Object.entries(FLOW_CHARACTERS).map(([value,character])=><option key={value} value={value}>{character.label}</option>)}</select></label>
    <label data-part="check" className="inline-flex items-center gap-[7px]"><input type="checkbox" checked={flow.hover} onChange={event=>setFlowSettings({hover:event.currentTarget.checked})}/>Pointer ghost</label>
    <Range control={['Speed',.25,3,.05,'×']} value={flow.speed} onChange={speed=>setFlowSettings({speed})}/><Range control={['Intensity',0,2,.05,'×']} value={flow.intensity} onChange={intensity=>setFlowSettings({intensity})}/><Range control={['Ghost strength',0,2,.05,'×']} value={flow.hoverStrength} onChange={hoverStrength=>setFlowSettings({hoverStrength})}/>
    <button type="button" onClick={resetFlow}>Reset flow</button>
   </fieldset>
   <fieldset><legend>Body behavior</legend><div data-part="choices" className="my-2 flex flex-wrap gap-x-4 gap-y-3 [&_label]:inline-flex [&_label]:items-center [&_label]:gap-[7px]">{Object.entries(BEHAVIORS).map(([key,label])=><label key={key}><input type="checkbox" checked={profile.cfg[key as keyof typeof BEHAVIORS]} onChange={event=>setMorphConfig({[key]:event.currentTarget.checked})}/>{label}</label>)}</div></fieldset>
   <details><summary>Feel and texture</summary><div data-part="grid" className="grid grid-cols-2 gap-x-6">{Object.entries(CONFIG).map(([key,control])=><Range key={key} control={control} value={profile.cfg[key as keyof MorphConfig] as number} onChange={value=>setMorphConfig({[key]:value})}/>)}</div></details>
   <fieldset><legend>Body shape</legend><label data-part="select-label" className="mb-3 grid gap-[6px]">Tier<select className={fieldVariants()} value={tier} onChange={event=>setTier(event.currentTarget.value as TierName)}>{Object.entries(TIERS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <Preview tier={tier}/><div data-part="grid" className="grid grid-cols-2 gap-x-6">{Object.entries(TIER_CONTROLS).map(([name,control])=>{const key=name as keyof Tier,domain=DOMAIN[key as keyof typeof DOMAIN],factor=key==='amp'||key==='press'?100:1;const limits:Control=[control[0],domain?.min??control[1],domain?.max[tier]??control[2],control[3],control[4]];return <Range key={name} control={limits} value={profile.TIER[tier][key]*factor} onChange={value=>setMorphTier(tier,{[key]:value/factor})}/>})}</div>
   </fieldset>
   <fieldset><legend>Body profile</legend><p>Export the shape and response of every body tier. Selection motion has its own controls above.</p><label htmlFor={id+'-json'}>Exported or imported profile</label><textarea className={fieldVariants()} id={id+'-json'} value={text} onChange={event=>setText(event.currentTarget.value)} spellCheck={false} rows={7}/><div data-part="actions" className="my-2 flex flex-wrap gap-x-4 gap-y-3"><button type="button" onClick={()=>{setText(exportMorphJSON());setError('');setNotice('Profile JSON is ready to copy.')}}>Export JSON</button><button type="button" onClick={importProfile}>Import JSON</button><button type="button" onClick={()=>{resetMorph();setError('');setNotice('Shipped runtime restored.')}}>Reset morph to runtime</button></div>{error&&<p role="alert" data-part="error">{error}</p>}<p role="status" aria-live="polite">{notice}</p></fieldset>
  </div>
 </section>
}
