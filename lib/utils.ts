import { FabricObject } from 'fabric';
import PSPoint from "./PSPoint";
import { PSStrokeIface } from "./PSStroke";

export type FabricPointerEvent = TouchEvent | MouseEvent | PointerEvent;

export interface FabricEvent {
  e: FabricPointerEvent;
  pointer: FabricPointer;
}

export interface FabricPointer {
  x: number;
  y: number;
}

export function isPSStroke(
  object: FabricObject | any
): object is PSStrokeIface {
  return object && object.get('type') === "PSStroke";
}

export function isPSPoint(object: any): object is PSPoint {
  return object && object["type"] === "PSPoint";
}

export function getPressure(
  ev: FabricPointerEvent,
  fallbackValue: number = 0.5
) {
  // TouchEvent
  if ((ev as any)["touches"] && (ev as any)["touches"].length > 0) {
    return (ev as TouchEvent).touches[0].force;
  }
  // MouseEvent, PointerEvent (ev.pointerType: "mouse")
  if ((ev as any)["pointerType"] === "mouse" || typeof (ev as PointerEvent).pressure !== "number") {
    return fallbackValue;
  }
  // PointerEvent (ev.pointerType: "pen" | "touch")
  if ((ev as any)["pointerType"] === "touch" && (ev as PointerEvent).pressure === 0) {
    return fallbackValue;
  }
  return (ev as PointerEvent).pressure;
}
