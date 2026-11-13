import { Bus, CarFront, CarTaxiFront } from 'lucide-react'
import type { VehicleType } from '@/lib/routes'

// One icon per vehicle type; callers always pair it with the text label.
const VEHICLE_ICONS = {
  auto: CarTaxiFront,
  minibus: Bus,
  bus: Bus,
  jeep: CarFront,
  van: CarFront,
} as const

export function VehicleIcon({
  type,
  className = 'size-3.5',
}: {
  type: VehicleType
  className?: string
}) {
  const Icon = VEHICLE_ICONS[type]

  return <Icon className={className} aria-hidden="true" />
}
