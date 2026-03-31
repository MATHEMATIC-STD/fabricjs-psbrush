/*!
 * Copyright (c) 2020-2022 Arch Inc. (Jun Kato, Kenta Hara)
 *
 * fabricjs-psbrush, a lightweight pressure-sensitive brush implementation for Fabric.js
 * @license MIT
 */
import {BaseBrush, Canvas, classRegistry, Color, Point, Shadow} from 'fabric';
import PressureManager, {PressureManagerIface} from "./PressureManager";
import PSPoint from "./PSPoint";
import PSSimplify from "./PSSimplify";
import PSStroke from "./PSStroke";
import {FabricPointerEvent} from "./utils";


export interface PSBrushIface extends BaseBrush {
  pressureManager: PressureManagerIface;
  pressureCoeff: number;
  simplifyTolerance: number;
  simplifyHighestQuality: boolean;
  pressureIgnoranceOnStart: number;
  opacity: number;
  disableTouch: boolean;
  readonly currentStartTime: number;

  onMouseDown(pointer: Point, options: { e: FabricPointerEvent }): void;

  onMouseMove(pointer: Point, options: { e: FabricPointerEvent }): void;

  onMouseUp(options: { e: FabricPointerEvent }): void;
}


/**
 * PSBrush class
 * @class PSBrush
 * @extends BaseBrush
 */
class PSBrush extends BaseBrush implements PSBrushIface {
  static type = 'PSBrush';
  public simplify = new PSSimplify();
  public pressureManager: PressureManagerIface;
  public pressureCoeff = 100;
  public simplifyTolerance = 0;
  public simplifyHighestQuality = false;
  public pressureIgnoranceOnStart = -1;
  public opacity = 1;
  public disableTouch = false;
  public currentStartTime: number = null;

  protected _points: PSPoint[] = [];
  protected oldEnd?: PSPoint;
  protected _needsFullRender: boolean = false;

  /**
   * Constructor
   * @param {Canvas} canvas
   * @return {PSBrush} Instance of a pencil brush
   */
  constructor(canvas: Canvas) {
    super(canvas);
    this.pressureManager = new PressureManager(this);
    this._points = [];
  }

  get type(): "PSBrush" {
    return "PSBrush";
  }
  set type(v: any) {
  }

  /**
   * Invoked inside on mouse down and mouse move
   * @param {CanvasRenderingContext2D} ctx
   * @param {PSPoint} p1
   * @param {PSPoint} p2
   */
  _drawSegment(ctx: CanvasRenderingContext2D, p1: PSPoint, p2: PSPoint) {
    const midPoint = p1.midPointFrom(p2);
    ctx.lineWidth = p1.pressure * this.width;
    ctx.quadraticCurveTo(p1.x, p1.y, midPoint.x, midPoint.y);
    return midPoint;
  }

  /**
   * Inovoked on mouse down
   * @param {Point} pointer
   * @param {Object} options
   */
  onMouseDown(pointer: Point, options: { e: FabricPointerEvent }) {
    const e = options.e;
    if (
      this.disableTouch &&
      e &&
      ((e as TouchEvent).touches || (e as PointerEvent).pointerType === "touch")
    ) {
      return;
    }

    this._prepareForDrawing(pointer, e);
    // capture coordinates immediately
    // this allows to draw dots (when movement never occurs)
    this._captureDrawingPath(pointer, e);
    this._render();
  }

  /**
   * Inovoked on mouse move
   * @param {Point} pointer
   * @param {Object} options
   */
  onMouseMove(pointer: Point, options: { e: FabricPointerEvent }) {
    const e = options.e;
    if (
      this.disableTouch &&
      e &&
      ((e as TouchEvent).touches || (e as PointerEvent).pointerType === "touch")
    ) {
      return;
    }

    if (this._captureDrawingPath(pointer, e) && this._points.length > 1) {
      if (this._needsFullRender) {
        // redraw curve
        // clear top canvas
        this.canvas.clearContext(this.canvas.contextTop);
        this._render();
      } else {
        const points = this._points,
          length = points.length,
          ctx = this.canvas.contextTop;

        // draw the curve update
        this._saveAndTransform(ctx);
        if (this.oldEnd) {
          ctx.beginPath();
          ctx.moveTo(this.oldEnd.x, this.oldEnd.y);
        }
        this.oldEnd = this._drawSegment(
          ctx,
          points[length - 2],
          points[length - 1]
        );
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /**
   * Invoked on mouse up
   * @param {Object} options
   */
  onMouseUp(options: { e: FabricPointerEvent }) {
    const e = options.e;
    if (
      this.disableTouch &&
      e &&
      ((e as TouchEvent).touches || (e as PointerEvent).pointerType === "touch")
    ) {
      return;
    }

    this.oldEnd = undefined;
    this._finalizeAndAddPath();
    this.pressureManager.onMouseUp();
  }

  /**
   * @private
   * @param {Point} pointer Actual mouse position related to the canvas.
   * @param {Object} ev
   */
  _prepareForDrawing(pointer: Point, ev: FabricPointerEvent) {
    const pressure = this.pressureManager.onMouseDown(ev);
    const p = new PSPoint(pointer.x, pointer.y, pressure);

    this._reset();
    this._addPoint(p);
    this.canvas.contextTop.moveTo(p.x, p.y);

    this.currentStartTime = Date.now();
  }

  /**
   * @private
   * @param {PSPoint} point Point to be added to points array
   */
  _addPoint(point: PSPoint) {
    if (
      this._points.length > 1 &&
      point.eq(this._points[this._points.length - 1])
    ) {
      return false;
    }
    this._points.push(point);
    return true;
  }

  /**
   * Clear points array and set contextTop canvas style.
   * @private
   */
  _reset() {
    this._points.length = 0;
    this._setBrushStyles(this.canvas.contextTop);
    const color = new Color(this.color);
    this._needsFullRender = color.getAlpha() < 1;
    this._setShadow();
  }

  /**
   * @private
   * @param {Point} pointer Actual mouse position related to the canvas.
   * @param {Object} ev
   */
  _captureDrawingPath(pointer: Point, ev: FabricPointerEvent) {
    const pressure = this.pressureManager.onMouseMove(ev, this._points);
    const pointerPoint = new PSPoint(pointer.x, pointer.y, pressure);
    return this._addPoint(pointerPoint);
  }

  /**
   * @private
   * @param {Array<PSPoint>} points
   */
  _redrawSegments(points: PSPoint[]) {
    const ctx = this.canvas.contextTop;
    this._saveAndTransform(ctx);
    if (this.oldEnd) {
      ctx.closePath();
    }
    let p = this._points[0];
    ctx.moveTo(p.x, p.y);
    ctx.beginPath();
    this._points.forEach(p2 => {
      this.oldEnd = this._drawSegment(ctx, p, p2);
      p = p2;
    });
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw a smooth path on the topCanvas using quadraticCurveTo
   * @private
   */
  _render() {
    const ctx = this.canvas.contextTop;
    let p1 = this._points[0],
      p2 = this._points[1],
      mid = p1;

    this._saveAndTransform(ctx);

    //if we only have 2 points in the path and they are the same
    //it means that the user only clicked the canvas without moving the mouse
    //then we should be drawing a dot. A path isn't drawn between two identical dots
    //that's why we set them apart a bit
    if (this._points.length === 2 && p1.x === p2.x && p1.y === p2.y) {
      const width = (p1.pressure * this.width) / 1000;
      p1 = new PSPoint(p1.x, p1.y, p1.pressure);
      p2 = new PSPoint(p2.x, p2.y, p2.pressure);
      p1.x -= width;
      p2.x += width;
      mid.x = p1.x;
    }

    const compositeOperation = ctx.globalCompositeOperation;
    const alpha = ctx.globalAlpha;
    ctx.globalCompositeOperation = "destination-atop";
    ctx.globalAlpha = this.opacity;
    for (let i = 1, len = this._points.length; i < len; i++) {
      ctx.beginPath();
      ctx.moveTo(mid.x, mid.y);
      // we pick the point between pi + 1 & pi + 2 as the
      // end point and p1 as our control point.
      mid = this._drawSegment(ctx, p1, p2);
      ctx.closePath();
      ctx.stroke();
      p1 = this._points[i];
      p2 = this._points[i + 1];
    }
    ctx.restore();
    ctx.globalCompositeOperation = compositeOperation;
    ctx.globalAlpha = alpha;
  }

  /**
   * Converts points to SVG path
   * @param {Array<PSPoint>} points Array of points
   * @return {Array<string>} SVG path
   */
  convertPointsToSVGPath(points: PSPoint[]) {
    const path = [],
      width = this.width / 1000;
    let p1 = new PSPoint(points[0].x, points[0].y, points[0].pressure),
      p2 = new PSPoint(points[1].x, points[1].y, points[1].pressure),
      mid = p1,
      len = points.length,
      multSignX = 1,
      multSignY = 1,
      manyPoints = len > 2;

    if (manyPoints) {
      multSignX = points[2].x < p2.x ? -1 : points[2].x === p2.x ? 0 : 1;
      multSignY = points[2].y < p2.y ? -1 : points[2].y === p2.y ? 0 : 1;
    }
    for (let i = 1; i < len; i++) {
      path.push(
        "M ",
        mid.x - multSignX * width,
        " ",
        mid.y - multSignY * width,
        " "
      );
      if (!p1.eq(p2)) {
        mid = p1.midPointFrom(p2);
        // p1 is our bezier control point
        // midpoint is our endpoint
        // start point is p(i-1) value.
        path.push("Q ", p1.x, " ", p1.y, " ", mid.x, " ", mid.y, " ");
      }
      p1 = points[i];
      if (i + 1 < points.length) {
        p2 = points[i + 1];
      }
    }
    if (manyPoints) {
      multSignX =
        p1.x > points[len - 2].x ? 1 : p1.x === points[len - 2].x ? 0 : -1;
      multSignY =
        p1.y > points[len - 2].y ? 1 : p1.y === points[len - 2].y ? 0 : -1;
    }
    path.push("L ", p1.x + multSignX * width, " ", p1.y + multSignY * width);
    return path;
  }

  /**
   * Creates PSStroke object to add on canvas
   * @param {Array<PSPoint>} points Path data
   * @return {PSStroke} Path to add on canvas
   */
  createPSStroke(points: PSPoint[]) {
    const path = new PSStroke(points, {
      fill: null,
      stroke: this.color,
      strokeWidth: this.width,
      strokeLineCap: this.strokeLineCap,
      strokeMiterLimit: this.strokeMiterLimit,
      strokeLineJoin: this.strokeLineJoin,
      strokeDashArray: this.strokeDashArray
    });

    let position = new Point(
      path.left + path.width / 2,
      path.top + path.height / 2
    );
    position = path.translateToGivenOrigin(
      position,
      "center",
      "center",
      path.originX,
      path.originY
    );
    path.top = position.y;
    path.left = position.x;
    if (this.shadow) {
      (this.shadow as any).affectStroke = true;
      path.shadow = new Shadow(this.shadow);
    }

    return path;
  }

  /**
   * On mouseup after drawing the path on contextTop canvas
   * we use the points captured to create an new fabric path object
   * and add it to the fabric canvas.
   */
  _finalizeAndAddPath() {
    const ctx = this.canvas.contextTop;
    ctx.closePath();

    // simplify the path
    if (this.simplifyTolerance > 0) {
      this.simplify.pressureCoeff = this.pressureCoeff;
      this.simplify.tolerance = this.simplifyTolerance;
      this._points = (this.simplify as PSSimplify).do(
        this._points,
        this.simplifyHighestQuality
      );
    }

    const pathData = this.convertPointsToSVGPath(this._points).join("");
    if (pathData === "M 0 0 Q 0 0 0 0 L 0 0") {
      // do not create 0 width/height paths, as they are
      // rendered inconsistently across browsers
      // Firefox 4, for example, renders a dot,
      // whereas Chrome 10 renders nothing
      this.canvas.requestRenderAll();
      return;
    }

    const path = this.createPSStroke(this._points) as any;
    path.opacity = this.opacity;
    path["startTime"] = this.currentStartTime;
    path["endTime"] = Date.now();
    this.canvas.clearContext(this.canvas.contextTop);
    this.canvas.add(path);
    path.setCoords();
    this._resetShadow();

    // fire event 'path' created
    this.canvas.fire("path:created", {path});
  }
}


classRegistry.setClass(PSBrush, 'PSBrush');
export default PSBrush;
