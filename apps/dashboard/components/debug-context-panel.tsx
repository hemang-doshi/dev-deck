"use client";

import { Bug, Clipboard, PanelRightOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export function DebugContextPanel({
  context,
  onCopy,
}: {
  context: string;
  onCopy: () => Promise<void>;
}) {
  return (
    <>
      <div className="xl:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button className="w-full rounded-full bg-white/85" variant="outline" />
            }
          >
            <PanelRightOpen className="size-4" />
            Debug context
          </SheetTrigger>
          <SheetContent className="border-white/80 bg-white/92 backdrop-blur-xl">
            <SheetHeader className="px-5 pt-5">
              <SheetTitle>Debug context</SheetTitle>
              <SheetDescription>Snapshot metadata ready to copy into an issue, prompt, or handoff.</SheetDescription>
            </SheetHeader>
            <Separator className="bg-slate-200/80" />
            <div className="p-5 pt-4">
              <Button className="w-full rounded-full" onClick={() => void onCopy()} variant="outline">
                <Clipboard className="size-4" />
                Copy debug context
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-10rem)] px-5 pb-5">
              <pre className="whitespace-pre-wrap rounded-3xl border border-slate-200 bg-slate-50 p-4 font-mono text-[13px] leading-6 text-slate-700">
                {context}
              </pre>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="hidden rounded-[1.75rem] border-white/70 bg-white/72 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl xl:flex xl:flex-col">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bug className="size-4 text-slate-500" />
              <CardTitle>Debug context</CardTitle>
            </div>
            <Button aria-label="Copy debug context" onClick={() => void onCopy()} size="sm" variant="outline">
              <Clipboard className="size-3.5" />
              Copy
            </Button>
          </div>
          <CardDescription>Snapshot metadata ready to paste into an issue, prompt, or handoff.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 pt-0">
          <ScrollArea className="h-[40rem] rounded-3xl border border-slate-200 bg-slate-50">
            <pre className="whitespace-pre-wrap p-4 font-mono text-[13px] leading-6 text-slate-700">
              {context}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}
