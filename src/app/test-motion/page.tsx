"use client";
import { m } from "framer-motion";
export default function TestMotion() {
  return <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Test</m.div>;
}
