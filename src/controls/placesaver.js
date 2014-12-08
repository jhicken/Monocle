Monocle.Controls.PlaceSaver = function (bookId) {

    var API = { constructor: Monocle.Controls.PlaceSaver }
    var k = API.constants = API.constructor;
    var p = API.properties = {}


    function initialize() {
        applyToBook(bookId);
    }


    function assignToReader(reader) {
        p.reader = reader;
        p.reader.listen('monocle:turn', savePlaceToCookie);
    }


    function applyToBook(bookId) {
        p.bkTitle = bookId.toLowerCase().replace(/[^a-z0-9]/g, '');
        p.prefix = k.NAMESPACE + p.bkTitle + ".";
    }


    function setLocalStorage(key, value) {
        localStorage[p.prefix + key] = value;
        return value;
    }


    function getLocalStorage(key) {
        return localStorage[p.prefix + key];
    }


    function savePlaceToCookie() {
        var place = p.reader.getPlace();
        setLocalStorage(
            "component",
            encodeURIComponent(place.componentId())
        );
        setLocalStorage(
            "percent",
            place.percentageThrough()
        );
    }


    function savedPlace() {
        var locus = {
            componentId: getLocalStorage('component'),
            percent: getLocalStorage('percent')
        }
        if (locus.componentId && locus.percent) {
            locus.componentId = decodeURIComponent(locus.componentId);
            locus.percent = parseFloat(locus.percent);
            return locus;
        } else {
            return null;
        }
    }


    function restorePlace() {
        var locus = savedPlace();
        if (locus) {
            p.reader.moveTo(locus);
        }
    }


    API.assignToReader = assignToReader;
    API.savedPlace = savedPlace;
    API.restorePlace = restorePlace;

    initialize();

    return API;
}

Monocle.Controls.PlaceSaver.NAMESPACE = "monocle.controls.placesaver.";
