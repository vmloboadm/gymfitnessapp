"use client";

import Link from "next/link";
import { MessageCircle, ClipboardList, Flame, Dumbbell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Button } from "~/components/ui/button";
import { studentStatus, type PersonalStudent } from "~/lib/personal-data";
import { cn } from "~/lib/utils";

const TONE = {
  green: "bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.8)]",
  amber: "bg-[#FFC24D] shadow-[0_0_8px_rgba(255,194,77,0.8)]",
  red: "bg-[#F87171] shadow-[0_0_8px_rgba(248,113,113,0.8)]",
} as const;

/** Bottom sheet de detalhes do aluno, reusado pelo Cockpit e pela lista de alunos. */
export function StudentSheet({
  student,
  onClose,
}: {
  student: PersonalStudent | null;
  onClose: () => void;
}) {
  const status = student ? studentStatus(student) : null;

  return (
    <BottomSheet open={!!student} onClose={onClose}>
      {student ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14 border-2 border-brand/60">
              <AvatarImage src={student.avatar} alt="" />
              <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-sm font-black text-brand-foreground">
                {student.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold text-foreground">{student.name}</p>
              {status ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("h-1.5 w-1.5 rounded-full", TONE[status.tone])} aria-hidden />
                  {status.label}
                </p>
              ) : null}
            </div>
          </div>

          {/* Treino ativo + streak */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Dumbbell className="h-3.5 w-3.5 text-brand" /> Treino ativo
              </p>
              <p className="mt-1 text-[13px] font-bold text-foreground">
                {student.activeWorkout ?? "Sem treino"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-[#FFC24D]" /> Streak atual
              </p>
              <p className="mt-1 text-[13px] font-bold text-foreground">
                {student.streak} {student.streak === 1 ? "dia" : "dias"}
              </p>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="grid grid-cols-2 gap-2">
            {student.whatsapp_consent && student.phone ? (
              <a
                href={`https://wa.me/${student.phone}?text=${encodeURIComponent(
                  `Oi ${student.name.split(" ")[0]}! Passando pra acompanhar seu treino. Bora evoluir hoje?`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="tactile flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366]/15 text-[12px] font-bold text-[#4ADE80] ring-1 ring-[#25D366]/30 transition-transform active:scale-[0.97]"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : (
              <span className="flex h-11 items-center justify-center gap-2 rounded-xl bg-white/[0.04] text-[11px] font-medium text-muted-foreground ring-1 ring-white/[0.06]">
                <MessageCircle className="h-4 w-4" />
                Sem consentimento
              </span>
            )}
            <Button asChild className="h-11 rounded-xl text-[12px] font-bold">
              <Link href="/personal/treinos">
                <ClipboardList className="mr-1.5 h-4 w-4" />
                Editar Treino
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
