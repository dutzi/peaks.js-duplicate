// import Konva from "konva";

let labelIndex = 0;
const labels = ['Sammy Jankis']

class CustomSegmentMarker {
  constructor(options) {
    // (required, see below)
    this._options = options;
    this.init = this.init.bind(this);
  }

  init(group) {
    const layer = this._options.layer;
    // console.log(this);
    const height = layer.getHeight() * 2;

    const render = (isOver) => {
      if (!this._line) {
        // console.log("no line");
        const imageObj = new Image();
        imageObj.src = "/drag.png";
        const dragWidth = 14;
        const dragHeight = 26;
        this._handle = new Konva.Image({
          x: -dragWidth / 2,
          y: height / 4 - dragHeight / 2,
          image: imageObj,
          width: dragWidth,
          height: dragHeight,
        });

        this._line = new Konva.Line({
          points: [0, 0, 0, 400], // x1, y1, x2, y2
          stroke: "#777",
          strokeWidth: 2,
        });

        this._hitArea = new Konva.Rect({
          x: -4,
          y: 0,
          width: 8,
          height: height / 2,
          fill: "transparent",
        });

        // console.log(this._options.layer._view._scale);
        const startPixel = this._options.layer._view.timeToPixels(
          this._options.segment.startTime
        );
        const endPixel = this._options.layer._view.timeToPixels(
          this._options.segment.endTime
        );

        // group.removeChildren()
        group.add(this._hitArea);
        // group.add(this._line);
        if (this._options.startMarker) {
          const yPadding = 25
          const xTextPadding = 5
          const yTextPadding = 5
          const lineHeight = 15
          // debugger;
          this._label = new Konva.Text({
            text: labels[labelIndex++%labels.length],
            fontSize: 15,
            width: endPixel - startPixel - xTextPadding * 2,
            fontWeight: 800,
            x: xTextPadding,
            y: height / 2 - yPadding - lineHeight - yTextPadding,
            ellipsis: true,
            wrap: "none",
          })
          this._rect = new Konva.Rect({
            x: 0,
            y: yPadding,
            width: endPixel - startPixel,
            height: height / 2 - yPadding*2,
            // fill: "black",
            stroke: "#777",
            strokeWidth: 2,
            // borderRadius: 100,
            cornerRadius: 8,
            shadowOffsetY: 2,
            shadowBlur: 2,
            shadowForStrokeEnabled: true,
            shadowColor: '#ccc'
            // shadowEnabled: true,
          });
          this._dragger = new Konva.Rect({
            x:0,
            width: endPixel - startPixel,
            height: 10,
            y: 5,
            fill: '#333',
            cornerRadius: 3
          })
          this._label.listening(false);
          this._rect.listening(false);
          // console.log("wtf22");
          // this._rect = new Konva.Line({
          //   points: [0, 10, endPixel - startPixel, 10], // x1, y1, x2, y2
          //   stroke: "#777",
          //   strokeWidth: 2,
          // });
          group.add(this._dragger);
          group.add(this._rect);
          group.add(this._label);

          this._dragger.addEventListener('mousedown', () => {
            this._isDragging = true;
            window.addEventListener('mouseup', () => {
              this._isDragging = false;
            })
          })
        }
        group.add(this._handle);
      } else {
        this._line.stroke(isOver ? "#03a9f4" : "#777");

        const imageObj = new Image();
        imageObj.src = isOver ? "/drag-hover.png" : "/drag.png";
        this._handle.image(imageObj);
        layer.draw();
      }
    };

    render();

    group.addEventListener("mousedown", (e) => {
      console.log(e)
      if (this._options.startMarker) {
        this._initDuration = this._options.segment.endTime - this._options.segment.startTime
      }
    });

    group.addEventListener("mouseenter", () => {
      render(true);
    });

    group.addEventListener("mouseleave", () => {
      render(false);
    });
    // this._handle = new Konva.Rect({
    //   x: -20,
    //   // y: this._options.,
    //   y: height / 4 - 10,
    //   width: 40,
    //   height: 20,
    //   fill: this._options.color,
    // });
  }

  fitToView() {
    console.log("fitToView");

    // (required, see below)
  }

  timeUpdated(options) {
    if (!this._options.startMarker) {
      console.log('hey')
      console.log(this._options.getStartMarker())
      console.log(this._options.getStartMarker()._marker.timeUpdated())
      return
    }

    if (this._isDragging) {
      this._options.segment._endTime = this._options.segment._startTime + this._initDuration
    }

    // console.log("timeUpdated", options);
    const startPixel = this._options.layer._view.timeToPixels(
      this._options.segment.startTime
    );
    const endPixel = this._options.layer._view.timeToPixels(
      this._options.segment.endTime
    );
    const xTextPadding = 5;
    this._rect.width(endPixel - startPixel);
    this._label.width(endPixel - startPixel - xTextPadding * 2)
    this._dragger.width(endPixel - startPixel)

    this._options.layer.draw();
    // (optional, see below)
  }

  destroy() {
    // (optional, see below)
  }
}

window.CustomSegmentMarker = CustomSegmentMarker;

window.init = (peaksInstance) => {
  // console.log(peaksInstance);

  let initNewSegmentTime = -1;
  let isAddedSegment = false;
  let segmentCounter = 0;

  peaksInstance.on("zoomview.mousedown", function (time) {
    initNewSegmentTime = time;
    isAddedSegment = false;
  });

  peaksInstance.on("zoomview.drag", function (time) {
    if (!isAddedSegment && Math.abs(time - initNewSegmentTime) < 0.1) {
      return;
    }

    if (!isAddedSegment) {
      peaksInstance.segments.add({
        startTime: time,
        endTime: time + 10,
        labelText: "Test segment " + segmentCounter++,
        editable: true,
      });
      isAddedSegment = true;
    }

    const lastSegment = peaksInstance.segments.getSegments().slice(-1)[0];

    if (time < initNewSegmentTime) {
      lastSegment.update({ startTime: time, endTime: initNewSegmentTime });
    } else {
      lastSegment.update({ endTime: time, startTime: initNewSegmentTime });
    }
  });

  peaksInstance.on("zoomview.mouseup", function (time) {
    // console.log("zoomview.mouseup", time);
  });
};
