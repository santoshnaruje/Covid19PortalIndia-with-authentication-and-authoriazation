const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const convertDistrict = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};
let db = null;
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const initialize = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server started");
    });
  } catch (e) {
    console.log(`DB Error:${e.message}`);
  }
};
initialize();

app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;

  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (password.length < 5) {
    response.status(400);
    response.send("Password is too short");
  } else if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender, location) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}',
          '${location}'
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send("User created successfully");
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(password, dbUser.password);

    if (isPasswordCorrect) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SANTOSH");
      response.status(200);
      console.log(jwtToken);
      response.send({
        jwtToken: jwtToken,
      });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SANTOSH", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", authenticateToken, async (request, response) => {
  const playersQuery = `select state_id as stateId,state_name as stateName,population from state`;
  let playersArray = await db.all(playersQuery);

  response.send(playersArray);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const playerQuery = `
  SELECT
   state_id as stateId,state_name as stateName,population
   FROM
   state
   WHERE
   state_id='${stateId}'
  ;`;
  let playerDetail = await db.get(playerQuery);
  response.send(playerDetail);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const postQuery = `
 INSERT INTO
 district(district_name,state_id,cases,cured,active,deaths)
 VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  const dbResponse = await db.run(postQuery);
  const districtId = dbResponse.lastID;
  console.log(districtId);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    console.log(districtId);
    const statesQuery = `
    SELECT 
    * 
    FROM
    district
    WHERE district_id='${districtId}';
    `;
    const dbResponse = await db.get(statesQuery);
    response.send(convertDistrict(dbResponse));
  }
);

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const putQuery = `
 UPDATE district
 SET
 district_name='${districtName}',
 state_id=${stateId},
 cases=${cases},
 cured=${cured},
 active=${active},
 deaths=${deaths}
 
 WHERE district_id='${districtId}'
 ;`;
    const dbResponse = await db.run(putQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statesQuery = `
    SELECT 
    sum(cases) as totalCases,
    sum(cured) as totalCured,
    sum(active) as totalActive,
    sum(deaths) as totalDeaths
    FROM
    district
    WHERE state_id='${stateId}';
    `;
    const dbResponse = await db.get(statesQuery);
    response.send(dbResponse);
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteQuery = `
    DELETE FROM 
    district
    WHERE district_id='${districtId}';`;

    const dbResponse = await db.run(deleteQuery);
    response.send("District Removed");
  }
);

module.exports = app;
