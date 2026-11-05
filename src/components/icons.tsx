import {
  Activity,
  Baby,
  Bone,
  Brain,
  Droplets,
  Ear,
  Eye,
  HeartPulse,
  Microscope,
  Ribbon,
  Smile,
  Stethoscope,
  Venus,
  Wind,
  Sparkles,
  Siren,
  HeartHandshake,
  type LucideIcon,
} from "lucide-react";

const DEPARTMENT_ICONS: Record<string, LucideIcon> = {
  HeartPulse,
  Brain,
  Bone,
  Baby,
  Venus,
  Ribbon,
  Droplets,
  Activity,
  Wind,
  Eye,
  Ear,
  Smile,
  Stethoscope,
  Microscope,
  Sparkles,
  Siren,
  HeartHandshake,
};

export function DepartmentIcon({ name, className }: { name: string; className?: string }) {
  const Icon = DEPARTMENT_ICONS[name] ?? Stethoscope;
  return <Icon className={className} aria-hidden />;
}
