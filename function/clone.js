/*


What can this do ?
    * Send your buckets schemas with same _id between to your new spica servers
    * Send your functions with dependencies and environments to your spica servers

The process of this asset works as follows: Suppose the main server is A and B's cloning server. You must download this asset to sender side

        Body 
            {
                server_name -> Required! Your functions, dependencies of functions and buckets schemas will send to B
                (accepted : server_name for example "test-a1b2c")

                bucket_names -> select the buckets that you want to clone

                environments -> if it is empty or  'true' then  your functions will send with environments to B
                (accepted : true , false or emtpy)
            }
            
You must raise the function maximum timeout up to 300 seconds from the Hq dashboard panel (advance settings)

*/

import * as Bucket from "@spica-devkit/bucket";
const fetch = require("node-fetch");

const PUBLIC_URL = process.env.__INTERNAL__SPICA__PUBLIC_URL__;

export async function sender(req, res) {
  const { environments, server_name, key, bucket_names } = req.query;
  let buckets_arr = bucket_names.split(",");

  let wanted_buckets = getWantedBuckets([...buckets_arr]);

  console.log(environments, server_name, key, wanted_buckets);

  Bucket.initialize({ apikey: `${process.env.API_KEY}` });
  const HOST = req.headers.get("host");
  let spesificSchema = false;

  /////////--------------Get Schemas-----------------////////////
  let schemas = await Bucket.getAll().catch((error) =>
    console.log("get all buckets error :", error)
  );

  schemas = schemas.filter(
    (schema) => JSON.stringify(wanted_buckets).indexOf(schema._id) > 0
  );
  spesificSchema = true;

  /////////--------------Get Schemas-----------------////////////

  /////////--------------Get Functions with dependencies and environments-----------------////////////
  let allFunctions = await getAllFunctions(HOST).catch((error) =>
    console.log("get allfunctions error :", error)
  );

  let isIgnore = false;
  let willSpliceIndex;
  for (let [index, fn] of allFunctions.entries()) {
    isIgnore = false;
    Object.keys(fn.env).forEach((e) => {
      if (e == "_IGNORE_") {
        isIgnore = true;
        willSpliceIndex = index;
        return;
      }
    });
    if (!isIgnore) {
      await getIndexes(fn._id, HOST)
        .then((index) => {
          fn.index = index;
        })
        .catch((error) => console.log("getIndexes error :", error));
      await getDependencies(fn._id, HOST)
        .then((dependency) => {
          fn.dependencies = dependency;
        })
        .catch((error) => console.log("getDependencies error :", error));
    }
  }
  allFunctions.splice(willSpliceIndex, 1);
  /////////--------------Get Functions with dependencies and environments-----------------////////////

  await fetch(
    `https://${server_name}.hq.spicaengine.com/api/fn-execute/receiver`,
    {
      method: "post",
      body: JSON.stringify({
        data: {
          schemas: schemas,
          allFunctions: allFunctions,
          spesificSchema: spesificSchema,
          env: !environments || environments == "true" ? true : false,
          key: key,
        },
      }),
      headers: { "Content-Type": "application/json" },
    }
  )
    .then((_) => {
      return res.status(200).send({ message: "Ok" });
    })
    .catch((error) => {
      console.log("error : ", error);
      return res.status(400).send({ message: error });
    });
}

async function getAllFunctions(HOST) {
  return new Promise(async (resolve, reject) => {
    await fetch(`https://${HOST}/api/function/`, {
      headers: {
        Authorization: `APIKEY ${process.env.API_KEY}`,
      },
    })
      .then((res) => res.json())
      .then(async (json) => {
        resolve(json);
      })
      .catch((error) => {
        reject(error);
        console.log("error : ", error);
      });
  });
}

async function getIndexes(id, HOST) {
  return new Promise(async (resolve, reject) => {
    await fetch(`https://${HOST}/api/function/${id}/index`, {
      headers: {
        Authorization: `APIKEY ${process.env.API_KEY}`,
      },
    })
      .then((res) => res.json())
      .then(async (json) => {
        resolve(json);
      })
      .catch((error) => {
        reject(error);
        console.log("error : ", error);
      });
  });
}

async function getDependencies(id, HOST) {
  return new Promise(async (resolve, reject) => {
    await fetch(`https://${HOST}/api/function/${id}/dependencies`, {
      headers: {
        Authorization: `APIKEY ${process.env.API_KEY}`,
      },
    })
      .then((res) => res.json())
      .then(async (json) => {
        resolve(json);
      })
      .catch((error) => {
        reject(error);
        console.log("error : ", error);
      });
  });
}

export async function senderDashboard() {
  Bucket.initialize({ apikey: `${process.env.API_KEY}` });

  const [bucketIds] = await Bucket.getAll().then((buckets) =>
    buckets.reduce(
      (acc, curr) => {
        acc[0].push(`${curr.title} ${curr._id}`);

        return acc;
      },
      [[]]
    )
  );

  console.log(bucketIds);

  return {
    title: "Sender Board",
    description:
      "Please fill the according form to complete operation. Don't forget to upload Clone-Receiver Side to destination server.",
    inputs: [
      {
        key: "environments",
        type: "boolean",
        value: "",
        title: "Environments",
      },
      {
        key: "server_name",
        type: "string",
        value: "",
        title: "Receiver Server Name",
      },
      {
        key: "key",
        type: "string",
        value: "",
        title: "Secret Api Key Receiver Side",
      },
      {
        key: "bucket_names",
        type: "multiselect",
        items: {
          type: "string",
          enum: Array.from(new Set(bucketIds)),
        },
        value: null,
        title: "Buckets",
      },
    ],
    button: {
      color: "primary",
      target: `${PUBLIC_URL}/fn-execute/sender`,
      method: "get",
      title: "Send Request",
    },
  };
}

function getWantedBuckets(bucket_arr) {
  let str = "";

  for (let bucket of bucket_arr) {
    str += idParser(bucket) + ",";
  }

  if (str.length > 0) {
    str = str.slice(0, -1);
  }

  return str;
}

function idParser(str) {
  var n = str.split(" ");
  return n[n.length - 1];
}
