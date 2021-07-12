/*


What can this do ?
    * Send your buckets schemas with same _id between to your new spica servers
    * Send your functions with dependencies and environments to your spica servers

The process of this asset works as follows: Suppose the main server is A and B's cloning server. You must download this asset to sender side

        Body 
            {
                server_name -> Required! Your functions, dependencies of functions and buckets schemas will send to B
                (accepted : server_name for example "test-a1b2c")

                unwanted_buckets -> if it is empty or  '*' then  your all buckets will send to B
                (accepted : * , with commas next to bucket id for example "bucket_id,bucket_id" or emtpy)

                environments -> if it is empty or  'true' then  your functions will send with environments to B
                (accepted : true , false or emtpy)
            }
            
You must raise the function maximum timeout up to 300 seconds from the Hq dashboard panel (advance settings)

*/

import * as Bucket from "@spica-devkit/bucket";
const fetch = require("node-fetch");

export async function sender(req, res) {
  const { unwanted_buckets, environments, server_name, key } = req.query;
  Bucket.initialize({ apikey: `${process.env.API_KEY}` });
  const HOST = req.headers.get("host");
  let spesificSchema = false;

  /////////--------------Get Schemas-----------------////////////
  let schemas = await Bucket.getAll().catch((error) =>
    console.log("get all buckets error :", error)
  );
  if (unwanted_buckets && unwanted_buckets != "*") {
    schemas = schemas.filter(
      (schema) => JSON.stringify(unwanted_buckets).indexOf(schema._id) == -1
    );
    spesificSchema = true;
  }
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

export function senderDashboard() {
  return {
    title: "Sender Board",
    description:
      "Please fill the according form to complete operation. Don't forget to upload Clone-Receiver Side to destination server.",
    inputs: [
      {
        key: "unwanted_buckets",
        type: "string",
        value: "",
        title: "Unwanted Buckets",
      },
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
    ],
    button: {
      color: "primary",
      target:
        "https://dvt-tst-2-886f5.hq.spicaengine.com/api/fn-execute/sender",
      method: "get",
      title: "Send Request",
    },
  };
}
