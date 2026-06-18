import { Shield, Globe, Radar, Lock, Bug, ServerCog } from "lucide-react"
import { Sparkles } from "@/components/ui/sparkles"
import { InfiniteSlider } from "@/components/ui/infinite-slider"
import { ProgressiveBlur } from "@/components/ui/progressive-blur"

const logos = [
  { id: "shield", component: Shield },
  { id: "globe", component: Globe },
  { id: "radar", component: Radar },
  { id: "lock", component: Lock },
  { id: "bug", component: Bug },
  { id: "server", component: ServerCog },
]

export function SparklesDemo() {
  return (
    <div className="h-screen w-full overflow-hidden">
      <div className="mx-auto mt-32 w-full max-w-2xl">
        <div className="text-center text-3xl text-foreground">
          <span className="text-indigo-200">Trusted by defenders.</span>
          <br />
          <span>Powered by the community.</span>
        </div>

        <div className="relative mt-7 h-[100px] w-full">
          <InfiniteSlider className="flex h-full w-full items-center" duration={30} gap={48}>
            {logos.map(({ id, component: Logo }) => (
              <div key={id} className="flex w-32 items-center justify-center text-slate-400">
                <Logo className="h-10 w-10" strokeWidth={1.5} />
              </div>
            ))}
          </InfiniteSlider>
          <ProgressiveBlur
            className="pointer-events-none absolute top-0 left-0 h-full w-[200px]"
            direction="left"
            blurIntensity={1}
          />
          <ProgressiveBlur
            className="pointer-events-none absolute top-0 right-0 h-full w-[200px]"
            direction="right"
            blurIntensity={1}
          />
        </div>
      </div>

      <div className="relative -mt-32 h-96 w-full overflow-hidden [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
        <div className="absolute inset-0 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_center,var(--gradient-color),transparent_70%)] before:opacity-40" />
        <div className="absolute -left-1/2 top-1/2 aspect-[1/0.7] z-10 w-[200%] rounded-[100%] border-t border-white/20 bg-zinc-900" />
        <Sparkles
          density={1200}
          className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,white,transparent_85%)]"
          color="#ffffff"
        />
      </div>
    </div>
  )
}
