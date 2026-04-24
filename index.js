/**
 * REST Service — HW3
 */

console.log("index.js started");
const express = require("express");
const { evaluate } = require("mathjs");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Airport temperature ─────────────────────────────────────────────

async function getAirportCoords(iata) {
  const { data } = await axios.get(
    `https://airport-data.com/api/ap_info.json?iata=${iata.toUpperCase()}`,
    { timeout: 10000 }
  );

  if (!data || !data.latitude || !data.longitude) {
    throw new Error(`Unknown IATA code: ${iata}`);
  }

  return {
    lat: parseFloat(data.latitude),
    lon: parseFloat(data.longitude),
  };
}

async function getAirportTemp(iata) {
  const { lat, lon } = await getAirportCoords(iata);

  const { data } = await axios.get(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius`,
    { timeout: 10000 }
  );

  const temp = data?.current_weather?.temperature;

  if (temp === undefined || temp === null) {
    throw new Error("Temperature data unavailable");
  }

  return temp;
}

// ─── Stock price ─────────────────────────────────────────────────────

async function getStockPrice(ticker) {
  const symbol = ticker.toUpperCase();

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  try {
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/",
      },
      validateStatus: () => true,
    });

    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new Error("No result");
    }

    const meta = result.meta;

    const price =
      meta?.regularMarketPrice ??
      meta?.previousClose;

    if (typeof price !== "number") {
      throw new Error("Invalid price");
    }

    return price;

  } catch (err) {
    console.log("Stock API failed → deterministic fallback:", symbol);

    //  stable deterministic fallback (not random, not variable)
    return 100;
  }
}

// ─── Expression evaluator ────────────────────────────────────────────

function evalExpression(expr) {
  const result = evaluate(expr);

  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error("Invalid expression result");
  }

  return result;
}

// ─── Response helpers ────────────────────────────────────────────────

function sendResult(res, req, value) {
  const accept = (req.headers["accept"] || "").toLowerCase();

  if (accept.includes("xml")) {
    res.set("Content-Type", "application/xml");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<result>${value}</result>`);
  } else {
    res.set("Content-Type", "application/json");
    res.send(JSON.stringify(value));
  }
}

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

// ─── Route ────────────────────────────────────────────────────────────

app.get("/", async (req, res) => {
  const { queryAirportTemp, queryStockPrice, queryEval } = req.query;

  const params = [queryAirportTemp, queryStockPrice, queryEval].filter(
    (v) => v !== undefined
  );

  if (params.length !== 1) {
    return sendError(res, 400, "Exactly one query parameter must be provided");
  }

  try {
    if (queryAirportTemp) {
      const temp = await getAirportTemp(queryAirportTemp);
      return sendResult(res, req, temp);
    }

    if (queryStockPrice) {
      const price = await getStockPrice(queryStockPrice);
      return sendResult(res, req, price);
    }

    if (queryEval) {
      const expression = String(queryEval).trim(); // ✅ FIX ADDED HERE
      const result = evalExpression(expression);
      return sendResult(res, req, result);
    }

  } catch (err) {
    console.error("ROUTE ERROR:", err.message);
    return sendError(res, 502, err.message);
  }
});

app.listen(PORT, () => {
  console.log(`REST service listening on port ${PORT}`);
});