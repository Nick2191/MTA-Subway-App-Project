import express from "express";
import axios from "axios";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import bodyParser from "body-parser";

const app = express();
const port = 3000;
const nqrwApi = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw";
const stationCodes = {
    "station1": { "South": "R01S", "North": "R01N" },
    "station3": { "South": "R03S", "North": "R03N" },
    "station4": { "South": "R04S", "North": "R04N" },
    "station5": { "South": "R05S", "North": "R05N" },
    "station6": { "South": "R06S", "North": "R06N" },
    "station8": { "South": "R08S", "North": "R08N" },
    "station9": { "South": "R09S", "North": "R09N" }
};

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("index.ejs");
 });

app.post("/submit", async (req, res) => {
    const station = req.body.station;
    const line = req.body.line;
    const direction = req.body.direction;
    const stopIds = stationCodes[station] ? stationCodes[station][direction] : "";

    if (!stopIds) {
        return res.status(400).send("Invalid station or direction");
    }
        try {
            const response = await axios.get(nqrwApi, { responseType: 'arraybuffer' });
            const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(response.data));

            const matchingUpdates = [];

            feed.entity.forEach((entity) => {
                if (entity.tripUpdate && entity.tripUpdate.trip.routeId === line) {
                    entity.tripUpdate.stopTimeUpdate.forEach((stopTimeUpdate) => {
                        if (stopIds.includes(stopTimeUpdate.stopId)) {
                            const departureTime = new Date(stopTimeUpdate.departure.time * 1000); // Convert Unix timestamp to Date object
                            const currentTime = new Date();
                            const minutesUntilDeparture = Math.floor((departureTime - currentTime) / 60000); // Calculate difference in minutes

                            if (minutesUntilDeparture >= 0) {
                            matchingUpdates.push(minutesUntilDeparture === 0 ? "Arriving Now" : minutesUntilDeparture);
                        }
                        }
                    });
                }
            });

            matchingUpdates.sort((a, b) => {
                if (a === "Arriving Now") return -1;
                if (b === "Arriving Now") return 1;
                return a - b;
            });
            res.render("widget.ejs", {timeToNextTrain: matchingUpdates, line: line});
        } catch (error) {
            console.error('Error fetching or decoding GTFS Realtime data:', error);
        }
 });

app.listen(port, () => {
    console.log(`App is listening on port ${port}`);
});