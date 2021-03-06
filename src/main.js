/**
 * @file
 *
 * Defines the {@link Peaks} class.
 *
 * @module peaks/main
 */
define('peaks', [
  'EventEmitter',
  'peaks/player/player',
  'peaks/waveform/waveform.core',
  'peaks/waveform/waveform.mixins',
  'peaks/player/player.keyboard'
], function(EventEmitter, Player, Waveform, mixins, KeyboardHandler) {
  'use strict';

  function buildUi(container) {
    return {
      player:   container.querySelector('.waveform'),
      zoom:     container.querySelector('.zoom-container'),
      overview: container.querySelector('.overview-container')
    };
  }

  function extend(to, from) {
    for (var key in from) {
      if (from.hasOwnProperty(key)) {
        to[key] = from[key];
      }
    }

    return to;
  }

  /**
   * Creates a new Peaks.js object.
   *
   * @class
   * @alias Peaks
   */
  function Peaks(container) {
    EventEmitter.call(this, { wildcard: true });

    this.options = {

      /**
       * Array of scale factors (samples per pixel) for the stepped zoom levels
       * (big >> small)
       */
      zoomLevels:            [512, 1024, 2048, 4096],

      /**
       * Data URI where to get the waveform data.
       *
       * If a string, we assume that `this.dataUriDefaultFormat` is the default
       * `xhr.responseType` value.
       *
       * @since 0.0.1
       *
       * ```js
       * dataUri: 'url/to/data.json?waveformId=1337'
       * ```
       *
       * If an object, each key is an `xhr.responseType` which will contain its
       * associated source URI.
       *
       * @since 0.3.0
       *
       * ```js
       * dataUri: {
       *   arraybuffer: 'url/to/data.dat',
       *   json: 'url/to/data.json'
       * }
       * ```
       */
      dataUri:               null,

      /**
       * Will be used as a `xhr.responseType` if `dataUri` is a string, and not
       * an object. Here for backward compatibility purpose only.
       *
       * @since 0.3.0
       */
      dataUriDefaultFormat:  'json',

      /**
       * Will report errors to that function
       *
       * @type {Function=}
       * @since 0.4.4
       */
      logger:                null,

      /**
       * Deprecation messages logger.
       *
       * @type {Function}
       * @since 0.4.8
       */
      deprecationLogger:     console.log.bind(console),

      /**
       * Bind keyboard controls
       */
      keyboard:              false,

      /**
       * Keyboard nudge increment in seconds (left arrow/right arrow)
       */
      nudgeIncrement:        0.01,

      /**
       * Colour for the in marker of segments
       */
      inMarkerColor:         '#a0a0a0',

      /**
       * Colour for the out marker of segments
       */
      outMarkerColor:        '#a0a0a0',

      /**
       * Colour for the zoomed in waveform
       */
      zoomWaveformColor:     'rgba(0, 225, 128, 1)',

      /**
       * Colour for the overview waveform
       */
      overviewWaveformColor: 'rgba(0,0,0,0.2)',

      /**
       * Colour for the overview waveform highlight rectangle, which shows
       * you what you see in the zoom view.
       */
      overviewHighlightRectangleColor: 'grey',

      /**
       * Random colour per segment (overrides segmentColor)
       */
      randomizeSegmentColor: true,

      /**
       * Height of the waveform canvases in pixels
       */
      height:                200,

      /**
       * Colour for segments on the waveform
       */
      segmentColor:          'rgba(255, 161, 39, 1)',

      /**
       * Colour of the play head
       */
      playheadColor:         'rgba(0, 0, 0, 1)',

      /**
       * Colour of the play head text
       */
      playheadTextColor:     '#aaa',

      /**
       * Colour of the axis gridlines
       */
      axisGridlineColor:     '#ccc',

      /**
       * Colour of the axis labels
       */
      axisLabelColor:        '#aaa',

      /**
       *
       */
      template:              [
                               '<div class="waveform">',
                               '<div class="zoom-container"></div>',
                               '<div class="overview-container"></div>',
                               '</div>'
                             ].join(''),

      /**
       * Color for point markers
       */
      pointMarkerColor:     '#FF0000',

      /**
       * Handler function called when point handle double clicked
       */
      pointDblClickHandler: null,

      /*
       * Handler function called when the point handle has finished dragging
       */
      pointDragEndHandler:  null,

      /**
       * WaveformData WebAudio Decoder Options
       *
       * You mostly want to play with the 'scale' option.
       *
       * @see https://github.com/bbcrd/waveform-data.js/blob/master/lib/builders/webaudio.js
       */
      waveformBuilderOptions: {
        scale: 512,
        scale_adjuster: 127
      },

      /**
       * Use animation on zoom - only relevant if zoom mode is 'stepped'
       */
      zoomAdapter: 'animated',

      /**
       * Which mode of zoom to use?
       *
       * The default is 'stepped', which tells Peaks to use the original
       * ZoomView (with static or animated adapters). A value of
       * 'continuous' tells Peaks to use the new continuous ZoomView
       */
      zoomMode: 'stepped',

      /**
       * The initial zoom level to work with
       */
      initialZoomLevel: 0,

      /**
       * We can specify the number of different breakpoints that should be
       * pre-sampled. Passing a value of null here will leave the decision
       * to the zoom view, which is recommended.
       *
       * If choosing to specify a value, 15 would be a sensible minimum
       */
      continuousZoomCacheSize: null,

      /**
       * Should we use the new editable overview that allows the user to adjust
       * the zoom level with drag handles
       */
      showEditableOverview: false,

      /**
       * Whether the editable overview should start in maximized state
       */
      editableOverviewIsMaximized: true,

      /**
       * How segment shapes should be drawn - defaults to 'wave', the other
       * option is 'rect'
       *
       * 'wave' is slightly inaccurate when using the continuous zoom style
       */
      segmentStyle: 'wave'
    };

    /**
     *
     * @type {HTMLElement}
     */
    this.container = container;

    /**
     * In 'stepped' zoom mode, this holds the current index of the zoomLevels array.
     * In 'continuous' zoom mode, this holds the current zoom level as a number
     * between 0 (zoomed fully out) and 1 (zoomed fully in)
     * @type {Number}
     */
    this.currentZoomLevel = 0;

    /**
     * Asynchronous errors logger.
     *
     * @type {Function}
     */
    this.logger = console.error.bind(console);
  }

  /**
   * Creates and initialises a new Peaks instance with the given options.
   *
   * @param {Object} opts Configuration options
   *
   * @return {Peaks}
   */
  Peaks.init = function init(opts) {
    opts = opts || {};
    opts.deprecationLogger = opts.deprecationLogger || console.log.bind(console);

    if (opts.audioElement) {
      opts.mediaElement = opts.audioElement;
      opts.deprecationLogger('[Peaks.init] `audioElement` option is deprecated. Please use `mediaElement` instead.');
    }

    if (!opts.mediaElement) {
      throw new Error('[Peaks.init] Please provide an audio element.');
    }

    if (!(opts.mediaElement instanceof HTMLMediaElement)) {
      throw new TypeError('[Peaks.init] The mediaElement option should be an HTMLMediaElement.');
    }

    if (!opts.container) {
      throw new Error('[Peaks.init] Please provide a container object.');
    }

    if ((opts.container.clientWidth > 0) === false) {
      throw new TypeError('[Peaks.init] Please ensure that the container has a width.');
    }

    if (opts.logger && typeof opts.logger !== 'function') {
      throw new TypeError('[Peaks.init] The `logger` option should be a function.');
    }

    var instance = new Peaks(opts.container);

    extend(instance.options, opts);
    extend(instance.options, {
      segmentInMarker:  mixins.defaultInMarker(instance.options),
      segmentOutMarker: mixins.defaultOutMarker(instance.options),
      segmentLabelDraw: mixins.defaultSegmentLabelDraw(instance.options),
      pointMarker:      mixins.defaultPointMarker(instance.options)
    });

    // set the initial zoom level
    instance.currentZoomLevel = instance.options.initialZoomLevel;

    /*
     Setup the logger
     */
    if (opts.logger) {
      instance.logger = opts.logger;
    }

    instance.on('error', instance.logger.bind(null));

    /*
     Setup the layout
     */
    if (typeof instance.options.template === 'string') {
      instance.container.innerHTML = instance.options.template;
    }
    else if (instance.options.template instanceof HTMLElement) {
      instance.container.appendChild(instance.options.template);
    }
    else {
      throw new TypeError('Please ensure you provide an HTML string or a DOM template as `template` instance option. Provided: ' + instance.options.template);
    }

    if (instance.options.keyboard) {
      instance.keyboardHandler = new KeyboardHandler(instance);
    }

    instance.player = new Player(instance);
    instance.player.init(instance.options.mediaElement);

    /*
     Setup the UI components
     */
    instance.waveform = new Waveform(instance);
    instance.waveform.init(buildUi(instance.container));

    instance.on('waveform_ready.overview', function() {
      instance.waveform.openZoomView();

      // Any initial segments to be displayed?
      if (instance.options.segments) {
        instance.segments.add(instance.options.segments);
      }

      // Any initial points to be displayed?
      if (instance.options.points) {
        instance.points.add(instance.options.points);
      }
    });

    return instance;
  };

  Peaks.prototype = Object.create(EventEmitter.prototype, {
    segments: {
      get: function() {
        var self = this;

        return {
          getSegments: function() {
            return self.waveform.segments.getSegments();
          },

          /**
           * Add one or more segments to the timeline
           *
           * @param {(...Object|Object[])} segmentOrSegments
           * @param {Number} segmentOrSegments[].startTime
           * @param {Number} segmentOrSegments[].endTime
           * @param {Boolean=} segmentOrSegments[].editable
           * @param {String=} segmentOrSegments[].color
           * @param {String=} segmentOrSegments[].labelText
           * @param {Number=} segmentOrSegments[].id
           */
          add: function(segmentOrSegments) {
            return self.waveform.segments.add.apply(self.waveform.segments, arguments);
          },

          remove: function(segment) {
            return self.waveform.segments.remove(segment);
          },

          /**
           * Remove segments with the given id
           *
           * @param {Number|String} id
           *
           * @api
           * @since 0.5.0
           */
          removeById: function(segmentId) {
            return self.waveform.segments.removeById(segmentId);
          },

          removeByTime: function(startTime, endTime) {
            return self.waveform.segments.removeByTime(startTime, endTime);
          },

          removeAll: function() {
            return self.waveform.segments.removeAll();
          }
        };
      }
    },

    /**
     * Points API
     */

    points: {
      get: function() {
        var self = this;

        return {

          /**
           * Return all points
           *
           * @returns {*|WaveformOverview.playheadLine.points|WaveformZoomView.playheadLine.points|points|o.points|n.createUi.points}
           */
          getPoints: function() {
            return self.waveform.points.getPoints();
          },

          /**
           * Add one or more points to the timeline
           *
           * @param {(...Object|Object[])} pointOrPoints
           * @param {Number} pointOrPoints[].timestamp
           * @param {Boolean=} pointOrPoints[].editable
           * @param {String=} pointOrPoints[].color
           * @param {String=} pointOrPoints[].labelText
           * @param {Number=} pointOrPoints[].id
           */
          add: function(pointOrPoints) {
            return self.waveform.points.add.apply(self.waveform.points, arguments);
          },

          remove: function(point) {
            return self.waveform.points.remove(point);
          },

          /**
           * Remove points at the given time
           *
           * @param {Number} timestamp
           */
          removeByTime: function(timestamp) {
            return self.waveform.points.removeByTime(timestamp);
          },

          /**
           * Remove points with the given id
           *
           * @param {Number|String} id
           *
           * @api
           * @since 0.5.0
           */
          removeById: function(pointId) {
            return self.waveform.points.removeById(pointId);
          },

          /**
           * Remove all points
           *
           * @api
           * @since 0.3.2
           */
          removeAll: function removeAll() {
            return self.waveform.points.removeAll();
          }
        };
      }
    },

    /**
     * Time API
     */

    time: {
      get: function() {
        var self = this;

        return {

          /**
           * Seeks the media player to that exact time.
           * Infers the playhead position to that same time.
           *
           * ```js
           * var p = Peaks.init(???);
           * p.time.setCurrentTime(20.5);
           * ```
           *
           * @param {Number} time
           */
          setCurrentTime: function setCurrentTime(time) {
            return self.player.seekBySeconds(time);
          },

          /**
           * Returns the actual time of the media element, in seconds.
           *
           * ```js
           * var p = Peaks.init(???);
           * p.time.getCurrentTime();     // -> 0
           * ```
           *
           * @returns {Number}
           */
          getCurrentTime: function() {
            return self.player.getTime();
          }
        };
      }
    },

    /**
     * Zoom API - a proxy for the current user zoom mode
     */
    zoom: {
      get: function() {
        // should current be one of 'stepped' or 'continuous'
        var zoomMode = this.options.zoomMode;

        // check to see if an invalid zoom mode was specified
        if (!this[zoomMode + '_zoom']) {
          throw new Error('Invalid zoomMode: ' + zoomMode);
        }

        return this[zoomMode + '_zoom'];
      }
    },

    /**
     * Continuous Zoom API
     */
    continuous_zoom: {
      get: function() {
        var self = this;

        return {

          /**
           * Zoom in one level
           */
          zoomIn: function() {
            self.continuous_zoom.zoomTo(self.currentZoomLevel + 0.1, true);
          },

          /**
           * Zoom out one level
           */
          zoomOut: function() {
            self.continuous_zoom.zoomTo(self.currentZoomLevel - 0.1, true);
          },

          /**
           * Sets the current zoom value
           *
           * @param {number} zoomValue - between 0 and 1
           * @param {bool} ease - whether or not the zoom should ease into position (true),
           * or whether it should be instant (false)
           */
          zoomTo: function(zoomValue, ease) {
            // clamp the input
            if (zoomValue > 1) {
              zoomValue = 1;
            }

            if (zoomValue < 0) {
              zoomValue = 0;
            }

            // if we want to ease the transition...
            if (ease) {
              var EASE_VALUE = 3;

              // we're easing, so we need to requestAnimationFrame and move in steps

              // start and end points of the zoom
              var finalZoomValue = zoomValue;
              var currentZoomValue = self.currentZoomLevel;

              // store the zoom value we're moving to
              self.currentZoomLevel = zoomValue;

              var step = function() {
                currentZoomValue += (finalZoomValue - currentZoomValue) / EASE_VALUE;

                // send out the interim zoom value
                self.emit('zoom.change', currentZoomValue);

                // if we're not close enough to the final position,
                // repeat the process next frame
                if (Math.abs(currentZoomValue - finalZoomValue) > 0.001) {
                  self.rafPointer = window.requestAnimationFrame(step);
                }
              };

              // cancel any existing requests...
              window.cancelAnimationFrame(self.rafPointer);
              // call the first step of the ease
              step();
            }
            else {
              // change immediately
              self.currentZoomLevel = zoomValue;
              self.emit('zoom.change', zoomValue);
            }
          },

          getMaximumScaleFactor: function() {
            return 512;
          },

          /**
           * Returns the current zoom level
           *
           * @returns {number}
           */
          getZoom: function() {
            return self.currentZoomLevel;
          }
        };
      }
    },

    /**
     * Stepped Zoom API
     */
    stepped_zoom: {
      get: function() {
        var self = this;

        return {

          /**
           * Zoom in one level
           */
          zoomIn: function() {
            self.stepped_zoom.setZoom(self.currentZoomLevel - 1);
          },

          /**
           * Zoom out one level
           */
          zoomOut: function() {
            self.stepped_zoom.setZoom(self.currentZoomLevel + 1);
          },

          /**
           * Given a particular zoom level, triggers a resampling of the data in the zoomed view
           *
           * @param {number} zoomLevelIndex
           */
          setZoom: function(zoomLevelIndex) { // Set zoom level to index of current zoom levels
            if (zoomLevelIndex >= self.options.zoomLevels.length) {
              zoomLevelIndex = self.options.zoomLevels.length - 1;
            }

            if (zoomLevelIndex < 0) {
              zoomLevelIndex = 0;
            }

            var previousZoomLevel = self.currentZoomLevel;

            self.currentZoomLevel = zoomLevelIndex;

            self.emit(
              'zoom.update',
              self.options.zoomLevels[zoomLevelIndex],
              self.options.zoomLevels[previousZoomLevel]
            );
          },

          /**
           * Returns the current zoom level
           *
           * @returns {number}
           */
          getZoom: function() {
            return self.currentZoomLevel;
          },

          /**
           * Sets the zoom level to an overview level
           *
           * @since 0.3
           */
          overview: function zoomToOverview() {
            self.emit(
              'zoom.update',
              self.waveform.waveformOverview.data.adapter.scale,
              self.options.zoomLevels[self.currentZoomLevel]
            );
          },

          /**
           * Sets the zoom level to an overview level
           *
           * @since 0.3
           */
          reset: function resetOverview() {
            self.emit(
              'zoom.update',
              self.options.zoomLevels[self.currentZoomLevel],
              self.waveform.waveformOverview.data.adapter.scale
            );
          }
        };
      }
    }
  });

  /**
   * Cleans up a Peaks instance after use.
   */
  Peaks.prototype.destroy = function() {
    this.removeAllListeners();
    this.waveform.destroy();
    this.player.destroy();
  };

  return Peaks;
});
