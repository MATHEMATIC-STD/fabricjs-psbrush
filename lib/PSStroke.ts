/*!
 * Copyright (c) 2020-2022 Arch Inc. (Jun Kato, Kenta Hara)
 *
 * fabricjs-psbrush, a lightweight pressure-sensitive brush implementation for Fabric.js
 * @license MIT
 */
import {classRegistry, FabricObject, util} from 'fabric';
import PSPoint from "./PSPoint";


export interface PSStrokeIface extends FabricObject {
  type: "PSStroke";
  startTime?: number;
  endTime?: number;
  strokePoints: PSPoint[];
}


/**
 * Pressure-sensitive stroke class
 * @class PSStroke
 * @extends FabricObject
 */
class PSStroke extends FabricObject implements PSStrokeIface {
  static type = 'PSStroke';

  get type(): "PSStroke" {
    return "PSStroke";
  }

  set type(v: any) {
  }

  /**
   * Array of stroke points
   * @type Array
   * @default
   */
  public strokePoints: PSPoint[] = [];

  /**
   * Time when this stroke started to be drawn
   * @type number
   */
  public startTime: number = null;

  /**
   * Time when this stroke finished to be drawn
   * @type number
   */
  public endTime: number = null;

  public strokeOffset: { x: number; y: number } = {x: 0, y: 0};

  static cacheProperties = [
    ...FabricObject.cacheProperties,
    "strokePoints",
    "startTime",
    "endTime",
  ];

  static stateProperties = [
    ...FabricObject.stateProperties,
    "strokePoints",
    "startTime",
    "endTime"
  ];

  /**
   * Constructor
   * @param {Array<PSPoint>} strokePoints Stroke data (sequence of coordinates and corresponding "command" tokens)
   * @param {Object} [options] Options object
   * @return {PSStroke} thisArg
   */
  constructor(strokePoints: PSPoint[], options: any = {}) {
    super(options);
    this.startTime = options.startTime;
    this.endTime = options.endTime;
    this.strokePoints = (strokePoints || []).map(p => p.clone());
    this._setPositionDimensions(options);
  }

  /**
   * @private
   * @param {Object} options Options object
   */
  _setPositionDimensions(options: any): void {
    const calcDim = this._parseDimensions();
    this.width = calcDim.width;
    this.height = calcDim.height;

    // respect positon in `options` for grouped stroke
    if (
      typeof options.left == "undefined" &&
      typeof options.top == "undefined"
    ) {
      this.left = calcDim.left;
      this.top = calcDim.top;
    }
    this.strokeOffset = {
      x: calcDim.left + this.width / 2,
      y: calcDim.top + this.height / 2
    };
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx context to render stroke on
   */
  _renderStroke(ctx: CanvasRenderingContext2D): void {
    let i: number,
      strokeWidth = this.strokeWidth / 1000,
      p1 = this.strokePoints[0],
      p2 = this.strokePoints[1],
      mid = p1,
      len = this.strokePoints.length,
      multSignX = 1,
      multSignY = 1,
      manyPoints = len > 2,
      l: number = -this.strokeOffset.x,
      t: number = -this.strokeOffset.y;

    if (manyPoints) {
      multSignX =
        this.strokePoints[2].x < p2.x
          ? -1
          : this.strokePoints[2].x === p2.x
            ? 0
            : 1;
      multSignY =
        this.strokePoints[2].y < p2.y
          ? -1
          : this.strokePoints[2].y === p2.y
            ? 0
            : 1;
    }

    //if we only have 2 points in the stroke and they are the same
    //it means that the user only clicked the canvas without moving the mouse
    //then we should be drawing a dot. A stroke isn't drawn between two identical dots
    //that's why we set them apart a bit
    if (this.strokePoints.length === 2 && p1.x === p2.x && p1.y === p2.y) {
      p1 = new PSPoint(p1.x, p1.y, p1.pressure);
      p2 = new PSPoint(p2.x, p2.y, p2.pressure);
      p1.x -= strokeWidth;
      p2.x += strokeWidth;
      mid.x = p1.x;
    }

    ctx.strokeStyle = this.stroke as string;
    ctx.lineCap = this.strokeLineCap;
    ctx.lineJoin = this.strokeLineJoin;

    for (i = 1, len = this.strokePoints.length; i < len; i++) {
      ctx.beginPath();
      ctx.moveTo(
        mid.x - multSignX * strokeWidth + l,
        mid.y - multSignY * strokeWidth + t
      );
      ctx.lineWidth = p1.pressure * this.strokeWidth;
      // we pick the point between pi + 1 & pi + 2 as the
      // end point and p1 as our control point.
      mid = p1.midPointFrom(p2);
      ctx.quadraticCurveTo(
        p1.x - multSignX * strokeWidth + l,
        p1.y - multSignY * strokeWidth + t,
        mid.x - multSignX * strokeWidth + l,
        mid.y - multSignY * strokeWidth + t
      );
      p1 = this.strokePoints[i];
      p2 = this.strokePoints[i + 1];

      ctx.stroke();
    }
  }

  /**
   * @private
   * @param {CanvasRenderingContext2D} ctx context to render stroke on
   */
  _render(ctx: CanvasRenderingContext2D): void {
    this._renderStroke(ctx);
    this._renderPaintInOrder(ctx);
  }

  /**
   * Returns string representation of an instance
   * @return {String} string representation of an instance
   */
  toString(): string {
    return (
      "#<PSStroke (" +
      this.complexity() +
      '): { "top": ' +
      this.top +
      ', "left": ' +
      this.left +
      " }>"
    );
  }

  /**
   * Returns object representation of an instance
   * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
   * @return {Object} object representation of an instance
   */
  toObject(propertiesToInclude: string[] = []): any {
    return {
      ...super.toObject(propertiesToInclude),
      strokePoints: this.strokePoints.map(i => i.clone()),
      startTime: this.startTime,
      endTime: this.endTime,
      top: this.top,
      left: this.left
    };
  }

  /**
   * Returns number representation of an instance complexity
   * @return {Number} complexity of this instance
   */
  complexity(): number {
    return this.strokePoints.length;
  }

  /**
   * Calculate 'bounding box' of stroke.
   * @private
   */
  _parseDimensions() {
    const self = this;

    function DummyCtx() {
      this.bounds = [];
      this.aX = [];
      this.aY = [];
      this.x = 0;
      this.y = 0;
    }

    DummyCtx.prototype._done = function () {
      this.bounds.forEach(point => {
        this.aX.push(point.x);
        this.aY.push(point.y);
      });
      this.aX.push(this.x);
      this.aY.push(this.y);
    };
    DummyCtx.prototype.moveTo = function (x: number, y: number) {
      this.x = x;
      this.y = y;
      this.bounds = [];
      this._done();
    };
    DummyCtx.prototype.quadraticCurveTo = function (
      ctlX: number,
      ctlY: number,
      x: number,
      y: number
    ) {
      // getBoundsOfCurve is now util.getBoundsOfCurve
      this.bounds = util.getBoundsOfCurve(
        this.x,
        this.y,
        ctlX,
        ctlY,
        ctlX,
        ctlY,
        x,
        y
      );
      this.x = x;
      this.y = y;
      this._done();
    };
    DummyCtx.prototype.calcBounds = function () {
      var minX = Math.min(...this.aX) || 0,
        minY = Math.min(...this.aY) || 0,
        maxX = Math.max(...this.aX) || 0,
        maxY = Math.max(...this.aY) || 0,
        deltaX = maxX - minX,
        deltaY = maxY - minY;

      return {
        left: minX,
        top: minY,
        width: deltaX,
        height: deltaY
      };
    };

    // belows are almost same function with _renderStroke, but some calling functions are ignored, and DummyCtx is used instead of normal Canvas context
    var ctx = new DummyCtx(),
      i,
      len,
      p1 = this.strokePoints[0],
      p2 = this.strokePoints[1],
      mid = p1;

    //if we only have 2 points in the stroke and they are the same
    //it means that the user only clicked the canvas without moving the mouse
    //then we should be drawing a dot. A stroke isn't drawn between two identical dots
    //that's why we set them apart a bit
    if (this.strokePoints.length === 2 && p1.x === p2.x && p1.y === p2.y) {
      var strokeWidth = this.strokeWidth / 1000;
      p1 = new PSPoint(p1.x, p1.y, p1.pressure);
      p2 = new PSPoint(p2.x, p2.y, p2.pressure);
      p1.x -= strokeWidth;
      p2.x += strokeWidth;
      mid.x = p1.x;
    }

    for (i = 1, len = this.strokePoints.length; i < len; i++) {
      // ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      // we pick the point between pi + 1 & pi + 2 as the
      // end point and p1 as our control point.
      mid = p1.midPointFrom(p2);
      ctx.quadraticCurveTo(p1.x, p1.y, mid.x, mid.y);

      // ctx.closePath();
      // ctx.stroke();
      p1 = this.strokePoints[i];
      p2 = this.strokePoints[i + 1];
    }

    return ctx.calcBounds();
  }

  /**
   * Creates an instance of PSStroke from an object
   * @static
   * @param {Object} object
   * @return {Promise<PSStroke>}
   */
  static async fromObject(object: any): Promise<PSStroke> {
    // Fabric 7 uses async fromObject
    const {strokePoints, ...options} = object;
    // enlivening points
    const enlivedStrokePoints = await Promise.all(
      (strokePoints || []).map((p: any) =>
        new Promise<PSPoint>(res => PSPoint.fromObject(p, res))
      )
    );
    return new PSStroke(enlivedStrokePoints, options);
  }
}


classRegistry.setClass(PSStroke, 'PSStroke');
export default PSStroke;
