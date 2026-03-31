import {classRegistry, Point} from 'fabric';


class PSPoint extends Point {
  static type = 'PSPoint';

  pressure: number;

  constructor(x: number, y: number, pressure: number) {
    super(x, y);
    this.pressure = pressure;
  }

  get type(): "PSPoint" {
    return "PSPoint";
  }

  set type(v: any) {
  }


  midPointFrom(p: PSPoint) {
    const mid = super.midPointFrom(p);
    return new PSPoint(mid.x, mid.y, (this.pressure + p.pressure) / 2);
  }

  clone() {
    return new PSPoint(this.x, this.y, this.pressure);
  }

  static fromObject(object: { x: number; y: number; pressure: number }, callback: (point: PSPoint) => void) {
    const point = new PSPoint(object.x, object.y, object.pressure);
    callback && callback(point);
    return point;
  }
}


classRegistry.setClass(PSPoint, 'PSPoint');
export default PSPoint;
