"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import {
  Search,
  MessageCircle,
  ClipboardList,
  Flame,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { BottomSheet } from "~/components/ui/bottom-sheet";
import { Button } from "~/components/ui/button";
import {
  demoPersonalStudents,
  studentStatus,
  type PersonalStudent,
} from "~/lib/personal-data";
import { cn } from "~/lib/utils";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const row: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] } },
};

const TONE = {
  green: "bg-[#4ADE80] shadow-[0_0_8px_rgba(74,222,128,0.8)]",
  amber: "bg-[#FFC24D] shadow-[0_0_8px_rgba(255,194,77,0.8)]",
  red: "bg-[#F87171] shadow-[0_0_8px_rgba(248,113,113,0.8)]",
} as const;

/**
 * Gestão de alunos (mobile): lista limpa com micro-status e bottom sheet
 * de detalhes com ações rápidas. Padrão visual idêntico ao app do aluno.
 */
export default function PersonalAlunosPage() {
  const students = useMemo(() => demoPersonalStudents(), []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PersonalStudent | null>(null);

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Alunos</h1>
          <p className="text-[11px] text-muted-foreground">
            {students.length} sob sua responsabilidade
          </p>
        </div>
      </header>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar aluno por nome..."
          aria-label="Buscar aluno"
          className="h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.05] pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        />
      </div>

      {/* Lista com stagger */}
      <motion.ul variants={container} initial="hidden" animate="show" className="space-y-2">
        {filtered.map((s) => {
          const status = studentStatus(s);
          return (
            <motion.li key={s.id} variants={row}>
              <button
                onClick={() => setSelected(s)}
                className="gf-card gf-glass flex w-full items-center gap-3 !rounded-2xl !p-3.5 text-left transition-transform active:scale-[0.985]"
              >
                <Avatar className="h-11 w-11 border border-white/[0.08]">
                  <AvatarImage src={s.avatar} alt="" />
                  <AvatarFallback className="bg-gradient-to-br from-brand to-brand-dark text-xs font-black text-brand-foreground">
                    {s.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", TONE[status.tone])} aria-hidden />
                    {status.label}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </motion.li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 text-center text-xs text-muted-foreground">
            Nenhum aluno encontrado para &quot;{q}&quot;.
          </li>
        ) : null}
      </motion.ul>

      {/* Bottom Sheet de detalhes */}
      <StudentSheet student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StudentSheet({ student, onClose }: { student: PersonalStudent | null; onClose: () => void }) {
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
