/**
 * @file
 *
 * Defines the {@link SubtitleShape} class.
 *
 * @module subtitle-shape
 */

define([
  './subtitle-marker'
], function(
    SubtitleMarker) {
  'use strict';

  var defaultFontFamily = 'sans-serif';
  var defaultFontSize = 10;
  var defaultFontShape = 'normal';

  /**
   * Creates a waveform subtitle shape with optional start and end markers.
   *
   * @class
   * @alias SubtitleShape
   *
   * @param {Subtitle} subtitle
   * @param {Peaks} peaks
   * @param {SubtitlesLayer} layer
   * @param {WaveformOverview|WaveformZoomView} view
   */

  function SubtitleShape(subtitle, peaks, layer, view) {
    this._subtitle      = subtitle;
    this._peaks         = peaks;
    this._layer         = layer;
    this._view          = view;
    this._label         = null;
    this._startMarker   = null;
    this._endMarker     = null;
    this._color         = subtitle.color;

    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onClick      = this._onClick.bind(this);

    // Event handlers for markers
    this._onSubtitleHandleDrag      = this._onSubtitleHandleDrag.bind(this);
    this._onSubtitleHandleDragStart = this._onSubtitleHandleDragStart.bind(this);
    this._onSubtitleHandleDragEnd   = this._onSubtitleHandleDragEnd.bind(this);

    this._label = this._peaks.options.createSubtitleLabel({
      subtitle:    subtitle,
      view:       this._view.getName(),
      layer:      this._layer,
      fontFamily: this._peaks.options.fontFamily,
      fontSize:   this._peaks.options.fontSize,
      fontStyle:  this._peaks.options.fontStyle
    });

    if (this._label) {
      this._label.hide();
    }

    this._createMarkers();
  }

  SubtitleShape.prototype.getSubtitle = function() {
    return this._subtitle;
  };

  SubtitleShape.prototype.getStartMarker = function() {
    return this._startMarker;
  };

  SubtitleShape.prototype.getEndMarker = function() {
    return this._endMarker;
  };

  SubtitleShape.prototype.addToLayer = function(layer) {
    if (this._label) {
      layer.add(this._label);
    }

    if (this._startMarker) {
      this._startMarker.addToLayer(layer);
    }

    if (this._endMarker) {
      this._endMarker.addToLayer(layer);
    }
  };

  SubtitleShape.prototype._createMarkers = function() {
    var editable = this._layer.isEditingEnabled() && this._subtitle.editable;

    if (!editable) {
      return;
    }

    var startMarker = this._peaks.options.createSubtitleMarker({
      subtitle:     this._subtitle,
      draggable:    editable,
      startMarker:  true,
      color:        this._peaks.options.subtitleStartMarkerColor,
      fontFamily:   this._peaks.options.fontFamily || defaultFontFamily,
      fontSize:     this._peaks.options.fontSize || defaultFontSize,
      fontStyle:    this._peaks.options.fontStyle || defaultFontShape,
      layer:        this._layer,
      view:         this._view.getName(),
      getEndMarker: () => this._endMarker
    });

    if (startMarker) {
      this._startMarker = new SubtitleMarker({
        layer:        this._layer,
        subtitle:     this._subtitle,
        subtitleShape:this,
        draggable:    editable,
        startMarker:  true,
        marker:       startMarker,
        onDrag:       this._onSubtitleHandleDrag,
        onDragStart:  this._onSubtitleHandleDragStart,
        onDragEnd:    this._onSubtitleHandleDragEnd,
        getEndMarker: () => this._endMarker
      });
    }

    var endMarker = this._peaks.options.createSubtitleMarker({
      subtitle:     this._subtitle,
      draggable:    editable,
      startMarker:  false,
      color:        this._peaks.options.subtitleEndMarkerColor,
      fontFamily:   this._peaks.options.fontFamily || defaultFontFamily,
      fontSize:     this._peaks.options.fontSize || defaultFontSize,
      fontStyle:    this._peaks.options.fontStyle || defaultFontShape,
      layer:        this._layer,
      view:         this._view.getName(),
      getStartMarker: () => this._startMarker
    });

    if (endMarker) {
      this._endMarker = new SubtitleMarker({
        layer:        this._layer,
        subtitle:     this._subtitle,
        subtitleShape:this,
        draggable:    editable,
        startMarker:  false,
        marker:       endMarker,
        onDrag:       this._onSubtitleHandleDrag,
        onDragStart:  this._onעHandleDragStart,
        onDragEnd:    this._onSubtitleHandleDragEnd,
        getStartMarker: () => this._startMarker
      });
    }
  };

  SubtitleShape.prototype._onMouseEnter = function() {
    if (this._label) {
      this._label.show();
      this._layer.draw();
    }

    this._peaks.emit('subtitles.mouseenter', this._subtitle);
  };

  SubtitleShape.prototype._onMouseLeave = function() {
    if (this._label) {
      this._label.hide();
      this._layer.draw();
    }

    this._peaks.emit('subtitles.mouseleave', this._subtitle);
  };

  SubtitleShape.prototype._onClick = function() {
    this._peaks.emit('subtitles.click', this._subtitle);
  };

  /**
   * @param {SubtitleMarker} subtitleMarker
   */

  SubtitleShape.prototype._onSubtitleHandleDrag = function(subtitleMarker) {
    var frameOffset = this._view.getFrameOffset();
    var width = this._view.getWidth();

    var startMarker = subtitleMarker.isStartMarker();

    var startMarkerX = this._startMarker.getX();
    var endMarkerX = this._endMarker.getX();

    if (startMarker && startMarkerX >= 0) {
      var startMarkerOffset = frameOffset +
                              startMarkerX +
                              this._startMarker.getWidth();

      this._subtitle._setStartTime(this._view.pixelsToTime(startMarkerOffset));

      subtitleMarker.timeUpdated(this._subtitle.startTime);
    }

    if (!startMarker && endMarkerX < width) {
      var endMarkerOffset = frameOffset + endMarkerX;

      this._subtitle._setEndTime(this._view.pixelsToTime(endMarkerOffset));

      subtitleMarker.timeUpdated(this._subtitle.endTime);
    }

    this._peaks.emit('subtitles.dragged', this._subtitle, startMarker);
  };

  /**
   * @param {SubtitleMarker} subtitleMarker
   */

  SubtitleShape.prototype._onSubtitleHandleDragStart = function(subtitleMarker) {
    var startMarker = subtitleMarker.isStartMarker();

    this._peaks.emit('subtitles.dragstart', this._subtitle, startMarker);
  };

  /**
   * @param {SubtitleMarker} subtitleMarker
   */

  SubtitleShape.prototype._onSubtitleHandleDragEnd = function(subtitleMarker) {
    var startMarker = subtitleMarker.isStartMarker();

    this._peaks.emit('subtitles.dragend', this._subtitle, startMarker);
  };

  SubtitleShape.prototype.fitToView = function() {
    if (this._startMarker) {
      this._startMarker.fitToView();
    }

    if (this._endMarker) {
      this._endMarker.fitToView();
    }
  };

  SubtitleShape.prototype.destroy = function() {
    if (this._label) {
      this._label.destroy();
    }

    if (this._startMarker) {
      this._startMarker.destroy();
    }

    if (this._endMarker) {
      this._endMarker.destroy();
    }
  };

  return SubtitleShape;
});
