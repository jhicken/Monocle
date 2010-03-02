Carlyle.Flippers.Slider = function (reader, setPageFn) {
  if (Carlyle.Flippers == this) {
    return new Carlyle.Flippers.Slider(reader, setPageFn);
  }

  // Constants
  var k = {
    FORWARDS: 1,
    BACKWARDS: -1,
    durations: {
      SLIDE: 240,
      FOLLOW_CURSOR: 100,
      ANTI_FLICKER_DELAY: 20
    }
  }


  // Properties
  var p = {
    pageCount: 2,
    activeIndex: 1,
    divs: {
      pages: []
    },
    // Properties relating to the current page turn interaction.
    turnData: {}
  }

  var API = {
    constructor: Carlyle.Flippers.Slider,
    properties: p,
    constants: k
  }


  function initialize() {
    p.reader = reader;
    p.setPageFn = setPageFn;
  }


  function addPage(pageDiv) {
    p.divs.pages.push(pageDiv);
  }


  function listenForInteraction() {
    p.reader.addEventListener(
      "carlyle:contact:start",
      function (evt) {
        if (lift(evt.carlyleData.contactX)) {
          evt.preventDefault();
        }
      }
    );
    p.reader.addEventListener(
      "carlyle:contact:move",
      function (evt) {
        if (turning(evt.carlyleData.contactX)) {
          evt.preventDefault();
        }
      }
    );
    p.reader.addEventListener(
      "carlyle:contact:end",
      function (evt) {
        if (drop(evt.carlyleData.contactX)) {
          evt.preventDefault();
        }
      }
    );
  }


  function getPlace(pageDiv) {
    pageDiv = pageDiv || upperPage();
    return p.reader.getBook().placeFor(pageDiv.contentDiv);
  }


  function moveTo(locus, componentId) {
    setPage(upperPage(), locus, componentId);
    completedTurn();
  }


  function setPage(pageDiv, locus, componentId, callback) {
    var spCallback = function (offset) {
      pageDiv.scrollerDiv.scrollLeft = offset;
      setX(pageDiv.scrollerDiv, 0, { duration: 0 }, callback);
    }
    return p.setPageFn(pageDiv, locus, componentId, spCallback);
  }


  // Returns to if the box-based x point is in the "Go forward" zone for
  // user turning a page.
  //
  function inForwardZone(x) {
    return x > p.reader.properties.pageWidth * 0.6;
  }


  // Returns to if the box-based x point is in the "Go backward" zone for
  // user turning a page.
  //
  function inBackwardZone(x) {
    return x < p.reader.properties.pageWidth * 0.4;
  }


  function upperPage() {
    return p.divs.pages[p.activeIndex];
  }


  function lowerPage() {
    return p.divs.pages[(p.activeIndex + 1) % 2];
  }


  function flipPages() {
    upperPage().style.zIndex = 1;
    lowerPage().style.zIndex = 2;
    return p.activeIndex = (p.activeIndex + 1) % 2;
  }


  function deferredCall(fn) {
    setTimeout(fn, k.durations.ANTI_FLICKER_DELAY);
  }


  function liftAnimationFinished(boxPointX) {
    p.turnData.animating = false;
    if (p.turnData.dropped) {
      drop(boxPointX);
      p.turnData.dropped -= 1;
    }
  }


  function lift(boxPointX) {
    if (p.turnData.animating || p.turnData.direction) {
      return false;
    }

    p.turnData.points = {
      start: boxPointX,
      min: boxPointX,
      max: boxPointX
    }

    if (inForwardZone(boxPointX)) {
      // At the end of the book, both page numbers are the same. So this is
      // a way to test that we can advance one page.
      var upperPlace = getPlace(upperPage());
      var lowerPlace = getPlace(lowerPage());
      // FIXME:
      if (!upperPlace || !lowerPlace || upperPlace.pageNumber() != lowerPlace.pageNumber()) {
        p.turnData.direction = k.FORWARDS;
        slideToCursor(boxPointX);
        liftAnimationFinished();
      }
      return true;
    } else if (inBackwardZone(boxPointX)) {
      p.turnData.animating = true;
      var place = getPlace();
      var pageSetSuccessfully = setPage(
        lowerPage(),
        { page: place.pageNumber() - 1 },
        place.componentId(),
        function () {
          p.turnData.direction = k.BACKWARDS;
          deferredCall(function() {
            jumpOut(function () {
              deferredCall(function () {
                flipPages();
                slideToCursor(boxPointX);
                liftAnimationFinished(boxPointX);
              });
            });
          });
        }
      );

      if (!pageSetSuccessfully) {
        p.turnData = {};
        return false;
      }
      return true;
    }
    return false;
  }


  function turning(boxPointX) {
    if (p.turnData.animating || !p.turnData.direction) {
      return false;
    }

    p.turnData.points.min = Math.min(p.turnData.points.min, boxPointX);
    p.turnData.points.max = Math.max(p.turnData.points.max, boxPointX);

    // For speed reasons, we constrain motions to a constant number per second.
    var stamp = (new Date()).getTime();
    var followInterval = k.durations.FOLLOW_CURSOR * 1;
    if (
      p.turnData.stamp &&
      stamp - p.turnData.stamp < followInterval
    ) {
      return false;
    }
    p.turnData.stamp = stamp;

    slideToCursor(boxPointX);

    return true;
  }


  function drop(boxPointX) {
    if (p.turnData.animating) {
      p.turnData.dropped = true;
      return true;
    }
    if (!p.turnData.direction) {
      return false;
    }

    p.turnData.animating = true;

    p.turnData.points.tap = p.turnData.points.max - p.turnData.points.min < 10;

    if (p.turnData.direction == k.FORWARDS) {
      if (
        p.turnData.points.tap ||
        p.turnData.points.start - boxPointX > 60 ||
        p.turnData.points.min >= boxPointX
      ) {
        // Completing forward turn
        slideOut(flipPages);
      } else {
        // Cancelling forward turn
        slideIn();
      }
      return true;
    } else if (p.turnData.direction == k.BACKWARDS) {
      if (
        p.turnData.points.tap ||
        boxPointX - p.turnData.points.start > 60 ||
        p.turnData.points.max <= boxPointX
      ) {
        // Completing backward turn
        slideIn();
      } else {
        // Cancelling backward turn
        slideOut(flipPages);
      }
      return true;
    }
    return false;
  }


  function completedTurn() {
    var place = getPlace();
    var resetTurn = function () {
      // FIXME!
      var evt = document.createEvent("Events");
      evt.initEvent("carlyle:turn", false, true);
      p.reader.properties.divs.box.dispatchEvent(evt);
      p.turnData = {};
    }

    if (
      !setPage(
        lowerPage(),
        { page: place.pageNumber() + 1 },
        place.componentId(),
        function () {
          jumpIn(resetTurn);
        }
      )
    ) {
      setPage(
        lowerPage(),
        { page: place.pageNumber() + 1 },
        place.componentId(),
        function () {
          jumpIn(resetTurn);
        }
      );
    }
  }


  function setX(elem, x, options, callback) {
    var transition;
    var duration;

    if (typeof(x) == "number") { x = x + "px"; }

    if (!options.duration) {
      duration = 0;
      transition = 'none';
    } else {
      duration = parseInt(options['duration']);
      transition = '-webkit-transform';
      transition += ' ' + duration + "ms";
      transition += ' ' + (options['timing'] || 'linear');
      transition += ' ' + (options['delay'] || 0) + 'ms';
    }

    if (typeof WebKitTransitionEvent != "undefined") {
      elem.style.webkitTransition = transition;
      elem.style.webkitTransform = "translateX("+x+")";
    } else if (transition != "none") {
      // Exit any existing transition loop.
      clearTimeout(elem.setXTransitionInterval)

      // FIXME: this is rather naive. We need to ensure that the duration is
      // constant, probably by multiplying step against the ACTUAL interval,
      // rather than the scheduled one (because on slower machines, the
      // interval may be much longer).
      var stamp = (new Date()).getTime();
      var frameRate = 40;
      var finalX = parseInt(x);
      var currX = getX(elem);
      var step = (finalX - currX) * (frameRate / duration);
      var stepFn = function () {
        var destX = currX + step;
        if (
          (new Date()).getTime() - stamp > duration ||
          Math.abs(currX - finalX) <= Math.abs((currX + step) - finalX)
        ) {
          clearTimeout(elem.setXTransitionInterval)
          elem.style.MozTransform = "translateX(" + finalX + "px)";
          if (elem.setXTCB) {
            elem.setXTCB();
          }
        } else {
          elem.style.MozTransform = "translateX(" + destX + "px)";
          currX = destX;
        }
      }

      elem.setXTransitionInterval = setInterval(stepFn, frameRate);
    } else {
      elem.style.MozTransform = "translateX("+x+")";
    }

    if (elem.setXTCB) {
      elem.removeEventListener('webkitTransitionEnd', elem.setXTCB, false);
      elem.setXTCB = null;
    }
    if (callback) {
      if (transition == "none" || getX(elem) == parseInt(x)) {
        callback();
      } else {
        elem.setXTCB = callback;
        elem.addEventListener('webkitTransitionEnd', elem.setXTCB, false);
      }
    }
  }


  function getX(elem) {
    if (typeof WebKitCSSMatrix == "object") {
      var matrix = window.getComputedStyle(elem).webkitTransform;
      matrix = new WebKitCSSMatrix(matrix);
      return matrix.m41;
    } else {
      var prop = elem.style.MozTransform;
      if (!prop || prop == "") { return 0; }
      return parseFloat((/translateX\((\-?.*)px\)/).exec(prop)[1]) || 0;
    }
  }


  /* NB: Jumps are always done by the hidden lower page. */

  function jumpIn(callback) {
    // Duration should be 0, but is set to 1 to address a 10.6 Safari bug.
    setX(lowerPage(), 0, { duration: 1 }, callback);
  }


  function jumpOut(callback) {
    setX(
      lowerPage(),
      0 - p.reader.properties.pageWidth,
      { duration: 0 },
      callback
    );
  }


  function jumpToCursor(cursorX, callback) {
    setX(
      lowerPage(),
      Math.min(0, cursorX - p.reader.properties.pageWidth),
      { duration: 0 },
      callback
    );
  }


  /* NB: Slides are always done by the visible upper page. */

  function slideIn(callback) {
    var slideOpts = {
      duration: k.durations.SLIDE,
      timing: 'ease-in'
    };
    var cb = completedTurn;
    if (callback && callback != completedTurn) {
      cb = function () { callback(); completedTurn(); }
    }
    setX(upperPage(), 0, slideOpts, cb);
  }


  function slideOut(callback) {
    var slideOpts = {
      duration: k.durations.SLIDE,
      timing: 'ease-in'
    };
    var cb = completedTurn;
    if (callback && callback != completedTurn) {
      cb = function () { callback(); completedTurn(); }
    }
    setX(upperPage(), 0 - p.reader.properties.pageWidth, slideOpts, cb);
  }


  function slideToCursor(cursorX, callback) {
    setX(
      upperPage(),
      Math.min(0, cursorX - p.reader.properties.pageWidth),
      { duration: k.durations.FOLLOW_CURSOR },
      callback
    );
  }


  // THIS IS THE CORE API THAT ALL FLIPPERS MUST PROVIDE.
  API.pageCount = p.pageCount;
  API.addPage = addPage;
  API.getPlace = getPlace;
  API.moveTo = moveTo;
  API.listenForInteraction = listenForInteraction;

  initialize();

  return API;
}