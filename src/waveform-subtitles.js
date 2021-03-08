/**
 * @file
 *
 * Defines the {@link WaveformTextSegments} class.
 *
 * @module waveform-textSegments
 */

define([
  'colors.css',
  './text-segment',
  './utils'
], function(Colors, TextSegment, Utils) {
  'use strict';

  /**
   * TextSegment parameters.
   *
   * @typedef {Object} TextSegmentOptions
   * @global
   * @property {Number} startTime TextSegment start time, in seconds.
   * @property {Number} endTime TextSegment end time, in seconds.
   * @property {Boolean=} editable If <code>true</code> the textSegment start and
   *   end times can be adjusted via the user interface.
   *   Default: <code>false</code>.
   * @property {String=} color TextSegment waveform color.
   *   Default: a random color.
   * @property {String=} labelText TextSegment label text.
   *   Default: an empty string.
   * @property {String=} id A unique textSegment identifier.
   *   Default: an automatically generated identifier.
   */

  /**
   * Handles all functionality related to the adding, removing and manipulation
   * of textSegments.
   *
   * @class
   * @alias WaveformTextSegments
   *
   * @param {Peaks} peaks The parent Peaks object.
   */

  function WaveformTextSegments(peaks) {
    this._peaks = peaks;
    this._textSegments = [];
    this._textSegmentsById = {};
    this._textSegmentIdCounter = 0;
    this._colorIndex = 0;
  }

  /**
   * Returns a new unique textSegment id value.
   *
   * @private
   * @returns {String}
   */

  WaveformTextSegments.prototype._getNextTextSegmentId = function() {
    return 'peaks.textSegment.' + this._textSegmentIdCounter++;
  };

  var colors = [
    Colors.navy,
    Colors.blue,
    Colors.aqua,
    Colors.teal,
    // Colors.olive,
    // Colors.lime,
    // Colors.green,
    Colors.yellow,
    Colors.orange,
    Colors.red,
    Colors.maroon,
    Colors.fuchsia,
    Colors.purple
    // Colors.black,
    // Colors.gray,
    // Colors.silver
  ];

  /**
   * @private
   * @returns {String}
   */

  WaveformTextSegments.prototype._getTextSegmentColor = function() {
    if (this._peaks.options.randomizeTextSegmentColor) {
      if (++this._colorIndex === colors.length) {
        this._colorIndex = 0;
      }

      return colors[this._colorIndex];
    }
    else {
      return this._peaks.options.textSegmentColor;
    }
  };

  /**
   * Adds a new textSegment object.
   *
   * @private
   * @param {TextSegment} textSegment
   */

  WaveformTextSegments.prototype._addTextSegment = function(textSegment) {
    this._textSegments.push(textSegment);

    this._textSegmentsById[textSegment.id] = textSegment;
  };

  /**
   * Creates a new textSegment object.
   *
   * @private
   * @param {TextSegmentOptions} options
   * @return {TextSegment}
   */

  WaveformTextSegments.prototype._createTextSegment = function(options) {
    // Watch for anyone still trying to use the old
    // createTextSegment(startTime, endTime, ...) API
    if (!Utils.isObject(options)) {
      // eslint-disable-next-line max-len
      throw new TypeError('peaks.textSegments.add(): expected a TextSegment object parameter');
    }

    var textSegmentOptions = {
      peaks: this._peaks
    };

    Utils.extend(textSegmentOptions, options);

    if (Utils.isNullOrUndefined(textSegmentOptions.id)) {
      textSegmentOptions.id = this._getNextTextSegmentId();
    }

    if (Utils.isNullOrUndefined(textSegmentOptions.color)) {
      textSegmentOptions.color = this._getTextSegmentColor();
    }

    if (Utils.isNullOrUndefined(textSegmentOptions.labelText)) {
      textSegmentOptions.labelText = '';
    }

    if (Utils.isNullOrUndefined(textSegmentOptions.editable)) {
      textSegmentOptions.editable = false;
    }

    return new TextSegment(textSegmentOptions);
  };

  /**
   * Returns all textSegments.
   *
   * @returns {Array<TextSegment>}
   */

  WaveformTextSegments.prototype.getTextSegments = function() {
    return this._textSegments;
  };

  /**
   * Returns the textSegment with the given id, or <code>null</code> if not found.
   *
   * @param {String} id
   * @returns {TextSegment|null}
   */

  WaveformTextSegments.prototype.getTextSegment = function(id) {
    return this._textSegmentsById[id] || null;
  };

  /**
   * Returns all textSegments that overlap a given point in time.
   *
   * @param {Number} time
   * @returns {Array<TextSegment>}
   */

  WaveformTextSegments.prototype.getTextSegmentsAtTime = function(time) {
    return this._textSegments.filter(function(textSegment) {
      return time >= textSegment.startTime && time < textSegment.endTime;
    });
  };

  /**
   * Returns all textSegments that overlap a given time region.
   *
   * @param {Number} startTime The start of the time region, in seconds.
   * @param {Number} endTime The end of the time region, in seconds.
   *
   * @returns {Array<TextSegment>}
   */

  WaveformTextSegments.prototype.find = function(startTime, endTime) {
    return this._textSegments.filter(function(textSegment) {
      return textSegment.isVisible(startTime, endTime);
    });
  };

  /**
   * Adds one or more textSegments to the timeline.
   *
   * @param {TextSegmentOptions|Array<TextSegmentOptions>} textSegmentOrTextSegments
   */

  WaveformTextSegments.prototype.add = function(/* textSegmentOrTextSegments */) {
    var self = this;

    var textSegments = Array.isArray(arguments[0]) ?
                   arguments[0] :
                   Array.prototype.slice.call(arguments);

    textSegments = textSegments.map(function(textSegmentOptions) {
      var textSegment = self._createTextSegment(textSegmentOptions);

      if (Utils.objectHasProperty(self._textSegmentsById, textSegment.id)) {
        throw new Error('peaks.textSegments.add(): duplicate id');
      }

      return textSegment;
    });

    textSegments.forEach(function(textSegment) {
      self._addTextSegment(textSegment);
    });

    this._peaks.emit('textSegments.add', textSegments);

    return textSegments
  };

  /**
   * Returns the indexes of textSegments that match the given predicate.
   *
   * @private
   * @param {Function} predicate Predicate function to find matching textSegments.
   * @returns {Array<Number>} An array of indexes into the textSegments array of
   *   the matching elements.
   */

  WaveformTextSegments.prototype._findTextSegment = function(predicate) {
    var indexes = [];

    for (var i = 0, length = this._textSegments.length; i < length; i++) {
      if (predicate(this._textSegments[i])) {
        indexes.push(i);
      }
    }

    return indexes;
  };

  /**
   * Removes the textSegments at the given array indexes.
   *
   * @private
   * @param {Array<Number>} indexes The array indexes to remove.
   * @returns {Array<TextSegment>} The removed {@link TextSegment} objects.
   */

  WaveformTextSegments.prototype._removeIndexes = function(indexes) {
    var removed = [];

    for (var i = 0; i < indexes.length; i++) {
      var index = indexes[i] - removed.length;

      var itemRemoved = this._textSegments.splice(index, 1)[0];

      delete this._textSegmentsById[itemRemoved.id];

      removed.push(itemRemoved);
    }

    return removed;
  };

  /**
   * Removes all textSegments that match a given predicate function.
   *
   * After removing the textSegments, this function also emits a
   * <code>textSegments.remove</code> event with the removed {@link TextSegment}
   * objects.
   *
   * @private
   * @param {Function} predicate A predicate function that identifies which
   *   textSegments to remove.
   * @returns {Array<TextSegment>} The removed {@link TextSegment} objects.
   */

  WaveformTextSegments.prototype._removeTextSegments = function(predicate) {
    var indexes = this._findTextSegment(predicate);

    var removed = this._removeIndexes(indexes);

    this._peaks.emit('textSegments.remove', removed);

    return removed;
  };

  /**
   * Removes the given textSegment.
   *
   * @param {TextSegment} textSegment The textSegment to remove.
   * @returns {Array<TextSegment>} The removed textSegment.
   */

  WaveformTextSegments.prototype.remove = function(textSegment) {
    return this._removeTextSegments(function(s) {
      return s === textSegment;
    });
  };

  /**
   * Removes any textSegments with the given id.
   *
   * @param {String} id
   * @returns {Array<TextSegment>} The removed {@link TextSegment} objects.
   */

  WaveformTextSegments.prototype.removeById = function(textSegmentId) {
    return this._removeTextSegments(function(textSegment) {
      return textSegment.id === textSegmentId;
    });
  };

  /**
   * Removes any textSegments with the given start time, and optional end time.
   *
   * @param {Number} startTime TextSegments with this start time are removed.
   * @param {Number?} endTime If present, only textSegments with both the given
   *   start time and end time are removed.
   * @returns {Array<TextSegment>} The removed {@link TextSegment} objects.
   */

  WaveformTextSegments.prototype.removeByTime = function(startTime, endTime) {
    endTime = (typeof endTime === 'number') ? endTime : 0;

    var fnFilter;

    if (endTime > 0) {
      fnFilter = function(textSegment) {
        return textSegment.startTime === startTime && textSegment.endTime === endTime;
      };
    }
    else {
      fnFilter = function(textSegment) {
        return textSegment.startTime === startTime;
      };
    }

    return this._removeTextSegments(fnFilter);
  };

  /**
   * Removes all textSegments.
   *
   * After removing the textSegments, this function emits a
   * <code>textSegments.remove_all</code> event.
   */

  WaveformTextSegments.prototype.removeAll = function() {
    this._textSegments = [];
    this._textSegmentsById = {};
    this._peaks.emit('textSegments.remove_all');
  };

  return WaveformTextSegments;
});
