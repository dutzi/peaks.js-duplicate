/**
 * @file
 *
 * Defines the {@link SubtitlesLayer} class.
 *
 * @module subtitles-layer
 */

define([
  './subtitle-shape',
  './utils',
  'konva'
], function(
    SubtitleShape,
    Utils,
    Konva) {
  'use strict';

  /**
   * Creates a Konva.Layer that displays subtitle markers against the audio
   * waveform.
   *
   * @class
   * @alias SubtitlesLayer
   *
   * @param {Peaks} peaks
   * @param {WaveformOverview|WaveformZoomView} view
   * @param {Boolean} allowEditing
   */

  function SubtitlesLayer(peaks, view, allowEditing) {
    this._peaks         = peaks;
    this._view          = view;
    this._allowEditing  = allowEditing;
    this._subtitleShapes = {};
    this._layer         = new Konva.Layer();

    this._onSubtitlesUpdate    = this._onSubtitlesUpdate.bind(this);
    this._onSubtitlesAdd       = this._onSubtitlesAdd.bind(this);
    this._onSubtitlesRemove    = this._onSubtitlesRemove.bind(this);
    this._onSubtitlesRemoveAll = this._onSubtitlesRemoveAll.bind(this);
    this._onSubtitlesDragged   = this._onSubtitlesDragged.bind(this);

    this._peaks.on('subtitles.update', this._onSubtitlesUpdate);
    this._peaks.on('subtitles.add', this._onSubtitlesAdd);
    this._peaks.on('subtitles.remove', this._onSubtitlesRemove);
    this._peaks.on('subtitles.remove_all', this._onSubtitlesRemoveAll);
    this._peaks.on('subtitles.dragged', this._onSubtitlesDragged);
  }

  /**
   * Adds the layer to the given {Konva.Stage}.
   *
   * @param {Konva.Stage} stage
   */

  SubtitlesLayer.prototype.addToStage = function(stage) {
    stage.add(this._layer);
  };

  SubtitlesLayer.prototype.enableEditing = function(enable) {
    this._allowEditing = enable;
  };

  SubtitlesLayer.prototype.isEditingEnabled = function() {
    return this._allowEditing;
  };

  SubtitlesLayer.prototype.formatTime = function(time) {
    return this._view.formatTime(time);
  };

  SubtitlesLayer.prototype._onSubtitlesUpdate = function(subtitle) {
    var redraw = false;
    var subtitleShape = this._subtitleShapes[subtitle.id];
    var frameOffset = this._view.getFrameOffset();
    var width = this._view.getWidth();
    var frameStartTime = this._view.pixelsToTime(frameOffset);
    var frameEndTime   = this._view.pixelsToTime(frameOffset + width);

    if (subtitleShape) {
      this._removeSubtitle(subtitle);
      redraw = true;
    }

    if (subtitle.isVisible(frameStartTime, frameEndTime)) {
      this._addSubtitleShape(subtitle);
      redraw = true;
    }

    if (redraw) {
      this.updateSubtitles(frameStartTime, frameEndTime);
    }
  };

  SubtitlesLayer.prototype._onSubtitlesAdd = function(subtitles) {
    var self = this;

    var frameOffset = self._view.getFrameOffset();
    var width = self._view.getWidth();

    var frameStartTime = self._view.pixelsToTime(frameOffset);
    var frameEndTime   = self._view.pixelsToTime(frameOffset + width);

    subtitles.forEach(function(subtitle) {
      if (subtitle.isVisible(frameStartTime, frameEndTime)) {
        self._addSubtitleShape(subtitle);
      }
    });

    self.updateSubtitles(frameStartTime, frameEndTime);
  };

  SubtitlesLayer.prototype._onSubtitlesRemove = function(subtitles) {
    var self = this;

    subtitles.forEach(function(subtitle) {
      self._removeSubtitle(subtitle);
    });

    self._layer.draw();
  };

  SubtitlesLayer.prototype._onSubtitlesRemoveAll = function() {
    this._layer.removeChildren();
    this._subtitleShapes = {};

    this._layer.draw();
  };

  SubtitlesLayer.prototype._onSubtitlesDragged = function(subtitle) {
    this._updateSubtitle(subtitle);
    this._layer.draw();
  };

  /**
   * Creates the Konva UI objects for a given subtitle.
   *
   * @private
   * @param {Subtitle} subtitle
   * @returns {SubtitleShape}
   */

  SubtitlesLayer.prototype._createSubtitleShape = function(subtitle) {
    return new SubtitleShape(subtitle, this._peaks, this, this._view);
  };

  /**
   * Adds a Konva UI object to the layer for a given subtitle.
   *
   * @private
   * @param {Subtitle} subtitle
   * @returns {SubtitleShape}
   */

  SubtitlesLayer.prototype._addSubtitleShape = function(subtitle) {
    var subtitleShape = this._createSubtitleShape(subtitle);

    subtitleShape.addToLayer(this._layer);

    this._subtitleShapes[subtitle.id] = subtitleShape;

    return subtitleShape;
  };

  /**
   * Updates the positions of all displayed subtitles in the view.
   *
   * @param {Number} startTime The start of the visible range in the view,
   *   in seconds.
   * @param {Number} endTime The end of the visible range in the view,
   *   in seconds.
   */

  SubtitlesLayer.prototype.updateSubtitles = function(startTime, endTime) {
    // Update subtitles in visible time range.
    var subtitles = this._peaks.subtitles.find(startTime, endTime);

    var count = subtitles.length;

    subtitles.forEach(this._updateSubtitle.bind(this));

    // TODO: in the overview all subtitles are visible, so no need to check
    count += this._removeInvisibleSubtitles(startTime, endTime);

    if (count > 0) {
      this._layer.draw();
    }
  };

  /**
   * @private
   * @param {Subtitle} subtitle
   */

  SubtitlesLayer.prototype._updateSubtitle = function(subtitle) {
    var subtitleShape = this._findOrAddSubtitleShape(subtitle);

    var subtitleStartOffset = this._view.timeToPixels(subtitle.startTime);
    var subtitleEndOffset   = this._view.timeToPixels(subtitle.endTime);

    var frameStartOffset = this._view.getFrameOffset();

    var startPixel = subtitleStartOffset - frameStartOffset;
    var endPixel   = subtitleEndOffset   - frameStartOffset;

    var marker = subtitleShape.getStartMarker();

    if (marker) {
      marker.setX(startPixel - marker.getWidth());
    }

    marker = subtitleShape.getEndMarker();

    if (marker) {
      marker.setX(endPixel);
    }
  };

  /**
   * @private
   * @param {Subtitle} subtitle
   */

  SubtitlesLayer.prototype._findOrAddSubtitleShape = function(subtitle) {
    var subtitleShape = this._subtitleShapes[subtitle.id];

    if (!subtitleShape) {
      subtitleShape = this._addSubtitleShape(subtitle);
    }

    return subtitleShape;
  };

  /**
   * Removes any subtitles that are not visible, i.e., are not within and do not
   * overlap the given time range.
   *
   * @private
   * @param {Number} startTime The start of the visible time range, in seconds.
   * @param {Number} endTime The end of the visible time range, in seconds.
   * @returns {Number} The number of subtitles removed.
   */

  SubtitlesLayer.prototype._removeInvisibleSubtitles = function(startTime, endTime) {
    var count = 0;

    for (var subtitleId in this._subtitleShapes) {
      if (Utils.objectHasProperty(this._subtitleShapes, subtitleId)) {
        var subtitle = this._subtitleShapes[subtitleId].getSubtitle();

        if (!subtitle.isVisible(startTime, endTime)) {
          this._removeSubtitle(subtitle);
          count++;
        }
      }
    }

    return count;
  };

  /**
   * Removes the given subtitle from the view.
   *
   * @param {Subtitle} subtitle
   */

  SubtitlesLayer.prototype._removeSubtitle = function(subtitle) {
    var subtitleShape = this._subtitleShapes[subtitle.id];

    if (subtitleShape) {
      subtitleShape.destroy();
      delete this._subtitleShapes[subtitle.id];
    }
  };

  /**
   * Toggles visibility of the subtitles layer.
   *
   * @param {Boolean} visible
   */

  SubtitlesLayer.prototype.setVisible = function(visible) {
    this._layer.setVisible(visible);
  };

  SubtitlesLayer.prototype.draw = function() {
    this._layer.draw();
  };

  SubtitlesLayer.prototype.destroy = function() {
    this._peaks.off('subtitles.update', this._onSubtitlesUpdate);
    this._peaks.off('subtitles.add', this._onSubtitlesAdd);
    this._peaks.off('subtitles.remove', this._onSubtitlesRemove);
    this._peaks.off('subtitles.remove_all', this._onSubtitlesRemoveAll);
    this._peaks.off('subtitles.dragged', this._onSubtitlesDragged);
  };

  SubtitlesLayer.prototype.fitToView = function() {
    for (var subtitleId in this._subtitleShapes) {
      if (Utils.objectHasProperty(this._subtitleShapes, subtitleId)) {
        var subtitleShape = this._subtitleShapes[subtitleId];

        subtitleShape.fitToView();
      }
    }
  };

  SubtitlesLayer.prototype.draw = function() {
    this._layer.draw();
  };

  SubtitlesLayer.prototype.getHeight = function() {
    return this._layer.getHeight();
  };

  return SubtitlesLayer;
});
