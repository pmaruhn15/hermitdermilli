import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
  getDoc,
  updateDoc,
  limit,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import { enableIndexedDbPersistence } from "firebase/firestore";

import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
// Register the plugin to all charts:
Chart.register(ChartDataLabels);
Chart.defaults.font.family = 'Nunito';


const firebaseConfig = {
  apiKey: "AIzaSyDArEFma0YPjyU8swmi-0oSERYE3EAJAhY",
  authDomain: "milchmonitor.firebaseapp.com",
  databaseURL:
    "https://milchmonitor-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "milchmonitor",
  storageBucket: "milchmonitor.appspot.com",
  messagingSenderId: "915032184931",
  appId: "1:915032184931:web:6b114bee8523636bab8056",
};
//init app
initializeApp(firebaseConfig);

//init services
const db = getFirestore();
const auth = getAuth();

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == "failed-precondition") {
    // Multiple tabs open, persistence can only be enabled
    // in one tab at a a time.
    // ...
  } else if (err.code == "unimplemented") {
    // The current browser does not support all of the
    // features required to enable persistence
    // ...
  } else {
    console.log("sucessfully set up persistence");
  }
});
// Subsequent queries will use persistence, if it was enabled successfully

//Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then((reg) => {
      console.log("service worker registered", reg);
    })
    .catch((err) => {
      console.log("service worker not registered", err.message);
    });
}

function initCRUD(user) {
  //collection ref
  const colRef = collection(db, "user", user.uid, "data");

  //queries
  const q = query(colRef, orderBy("date", "desc"));
  const i = query(colRef, orderBy("date", "asc"));
  const lastfed = query(
    colRef,
    where("action", "==", "Stillen"),
    orderBy("date", "desc"),
    limit(1)
  );

  function displayLastFedTime(lastfed) {
    onSnapshot(lastfed, (snapshot) => {
      snapshot.docs.forEach((doc) => {
        let lastfedtime = new Date(doc.data().date.seconds * 1000);
        let elapsedtime = new Date() - lastfedtime - 3600000;
        document.getElementById("timeSinceLastFed").innerHTML = new Date(
          elapsedtime
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      });
    });
  }

  displayLastFedTime(lastfed);
  setTimeout(function(){
    displayLastFedTime(lastfed);
  }, 60000);
  

  //charts
  onSnapshot(i, (snapshot) => {
    let data = [];
    snapshot.docs.forEach((doc) => {
      data.push({
        ...doc.data(),
        id: doc.id,
        day: new Date(doc.data().date.seconds * 1000).toDateString(),
      });
    });
    console.log(data);

    //aggregate data by days
    var result = [];
    data.reduce(function (res, value) {
      if (!res[value.day]) {
        res[value.day] = {
          day: value.day,
          amount: 0,
          amountMm: 0,
          amountPre: 0,
          weight: 0,
        };
        result.push(res[value.day]);
      }
      res[value.day].amount += value.amount;
      res[value.day].amountMm += value.amountMm;
      res[value.day].amountPre += value.amountPre;
      res[value.day].weight += value.weight;
      return res;
    }, {});

    //delete dates with no weight data
    for (var day in result) {
      if (result[day].weight == 0) {
        delete result[day].weight;
      }
    }

    //create chart object
    const ctx_weight = document.getElementById("weightchart").getContext("2d");
    let chartStatus_weigth = Chart.getChart("weightchart");
    if (chartStatus_weigth != undefined) {
      chartStatus_weigth.destroy();
    }
    new Chart(ctx_weight, {
      type: "line",
      data: {
        labels: result.map((row) =>
          new Date(row.day).toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          })
        ),
        datasets: [
          {
            label: "Gewicht",
            data: result.map((row) => row.weight),
            borderColor: "#E55934",
            backgroundColor: "#E55934",
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false,
            text: "Gewicht",
          },
          datalabels: {
            color: "#210124",
            anchor: "top",
            align: "end",
            offset: 0,
            font: {
              size: 8,
            },
          },
        },
        responsive: true,
        scales: {
          x: {
              ticks: {
                  display: false
              }
          }
      }
      },
    });

    //create chart object
    const ctx = document.getElementById("chart").getContext("2d");
    let chartStatus = Chart.getChart("chart");
    if (chartStatus != undefined) {
      chartStatus.destroy();
    }
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: result.map((row) =>
          new Date(row.day).toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          })
        ),
        datasets: [
          {
            label: "Mutter-Milch",
            data: result.map((row) => row.amountMm),
            backgroundColor: "#210124",
            borderRadius: 2,
          },
          {
            label: "Pre-Milch",
            data: result.map((row) => row.amountPre),
            backgroundColor: "#B3DEC1",
            borderRadius: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false,
            text: "Zugefüttert",
          },
          legend: {
            labels: {
                // This more specific font property overrides the global property
                // font: {
                //     family: 'Nunito'
                // }
            }
        },
          datalabels: {
            color: "#FEFFFE",
            anchor: "end",
            align: "start",
            offset: 0,
            font: {
              size: 8,
            },
          },
        },
        responsive: true,
        scales: {
          x: {
            stacked: true,
          },
          y: {
            stacked: true,
          },
        },
      },
    });
  });

  //real time collection data
  onSnapshot(q, (snapshot) => {
    var mytable = "<table>";
    mytable +=
      "<tr><th>Datum, Uhrzeit</th><th>Aktion</th><th>Info</th><th>Ändern</th><th>Entfernen</th></tr>";
    snapshot.docs.forEach((doc) => {
      mytable += "<tr>";
      mytable +=
        "<td>" +
        new Date(doc.data().date.seconds * 1000).toLocaleDateString("de-de", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }) +
        new Date(doc.data().date.seconds * 1000).toLocaleTimeString("de-de", {
          hour: "2-digit",
          minute: "2-digit",
        }) +
        "</td>";
      // mytable += "<td>" +new Date(doc.data().date.seconds*1000).toLocaleTimeString('de-de', {hour: '2-digit', minute:'2-digit'})  + "</td>";
      mytable += "<td>" + doc.data().action + "</td>";
      switch (doc.data().action) {
        case "Pumpen":
          mytable += `<td>${doc.data().amount} ml</td>`;
          break;
        case "Stillen":
          mytable += `<td>${doc.data().amountMm} ml Muttermilch | ${
            doc.data().amountPre
          } ml Pre-Milch</td>`;
          break;
        case "Wiegen":
          mytable += `<td>${doc.data().weight} g</td>`;
          break;
      }
      mytable +=
        "<td><button class='update-button btn-primary btn-edit' data-id=" +
        doc.id +
        "><i style='margin:0' class='fa-solid fa-pen'></i></button></td>";
      mytable +=
        "<td><button class='delete-button btn-primary btn-danger' data-id=" +
        doc.id +
        "><i style='margin:0' class='fa-solid fa-trash'></i></button></td>";
      mytable += "</tr>";
    });
    mytable += "</table>";
    document.getElementById("historyTable").innerHTML = mytable;

    // add update function to buttons
    var btns = document.getElementsByClassName("update-button");
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function (btn) {
        //get document
        const docRef = doc(colRef, btn.originalTarget.dataset.id);
        getDoc(docRef).then((doc) => {
          if (doc.data().action == "Pumpen") {
            var updateForm = document.getElementById("update");
            updateForm.style.display = "block";
            updateForm.date.setAttribute(
              "value",
              new Date(doc.data().date.seconds * 1000)
            );
            updateForm.amount.setAttribute("value", doc.data().amount);
            updateForm.setAttribute("data-id", doc.id);
          }
          if (doc.data().action == "Stillen") {
            console.log("still update button pressed");
            var updateForm = document.getElementById("updateFeed");
            updateForm.style.display = "block";
            updateForm.date.setAttribute(
              "value",
              new Date(doc.data().date.seconds * 1000)
            );
            updateForm.amountMm.setAttribute("value", doc.data().amountMm);
            updateForm.amountPre.setAttribute("value", doc.data().amountPre);
            updateForm.setAttribute("data-id", doc.id);
          }
          if (doc.data().action == "Wiegen") {
            var updateForm = document.getElementById("updateWeight");
            updateForm.style.display = "block";
            updateForm.date.setAttribute(
              "value",
              new Date(doc.data().date.seconds * 1000)
            );
            updateForm.weight.setAttribute("value", doc.data().weight);
            updateForm.setAttribute("data-id", doc.id);
          }
        });
      });
    }

    // add delete function to delete buttons
    var btns = document.getElementsByClassName("delete-button");
    for (let i = 0; i < btns.length; i++) {
      btns[i].addEventListener("click", function (btn) {
        const docRef = doc(colRef, btn.originalTarget.dataset.id);
        deleteDoc(docRef);
      });
    }
  });

  //adding documents Pumpen
  const addPumpForm = document.querySelector(".add");
  // addPumpForm[0].setAttribute("value", new Date()); //set current time in input form
  addPumpForm.addEventListener("submit", (e) => {
    e.preventDefault();

    addDoc(colRef, {
      date: new Date(addPumpForm.date.value),
      amount: Number(addPumpForm.amount.value),
      amountMm: null,
      amountPre: null,
      weight: null,
      action: "Pumpen",
    }).then(() => {
      addPumpForm.reset();
      addPumpForm[0].setAttribute("value", new Date()); //set current time in input form
    });
  });

  //adding documents Stillen
  const addFeedForm = document.querySelector(".addFeed");
  addFeedForm[0].setAttribute("value", new Date()); //set current time in input form
  addFeedForm.addEventListener("submit", (e) => {
    e.preventDefault();

    addDoc(colRef, {
      date: new Date(addFeedForm.date.value),
      amount: null,
      amountMm: Number(addFeedForm.amountMm.value),
      amountPre: Number(addFeedForm.amountPre.value),
      weight: null,
      action: "Stillen",
    }).then(() => {
      addFeedForm.reset();
      addFeedForm[0].setAttribute("value", new Date()); //set current time in input form
    });
  });

  //adding documents Gewicht
  const addWeightForm = document.querySelector(".addWeight");
  addWeightForm[0].setAttribute("value", new Date()); //set current time in input form
  addWeightForm.addEventListener("submit", (e) => {
    e.preventDefault();

    addDoc(colRef, {
      date: new Date(addWeightForm.date.value),
      amount: null,
      amountMm: null,
      amountPre: null,
      weight: Number(addWeightForm.weight.value),
      action: "Wiegen",
    }).then(() => {
      addWeightForm.reset();
      addWeightForm[0].setAttribute("value", new Date()); //set current time in input form
    });
  });

  //updating documents
  const updateForm = document.querySelector("#update");
  updateForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const docRef = doc(colRef, updateForm.dataset.id);
    updateDoc(docRef, {
      date: new Date(updateForm.date.value),
      amount: Number(updateForm.amount.value),
    }).then(() => {
      updateForm.style.display = "none";
    });
  });
  const updateFeedForm = document.querySelector("#updateFeed");
  updateFeedForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const docRef = doc(colRef, updateFeedForm.dataset.id);
    updateDoc(docRef, {
      date: new Date(updateFeedForm.date.value),
      amountMm: Number(updateFeedForm.amountMm.value),
      amountPre: Number(updateFeedForm.amountPre.value),
    }).then(() => {
      updateFeedForm.style.display = "none";
    });
  });
  const updateWeightForm = document.querySelector("#updateWeight");
  updateWeightForm.addEventListener("submit", (e) => {
    console.log();
    const docRef = doc(colRef, updateWeightForm.dataset.id);
    updateDoc(docRef, {
      date: new Date(updateWeightForm.date.value),
      weight: Number(updateWeightForm.weight.value),
    }).then(() => {
      updateWeightForm.style.display = "none";
    });
  });

  //     const uploadBulkButton = document.querySelector('.uploadbulk')
  // uploadBulkButton.addEventListener('click', (e) => {
  //     e.preventDefault()

  //     data_to_upload.forEach(function(obj) {
  //         addDoc(colRef,{
  //             date: new Date(obj.date),
  //             amount: obj.amount,
  //             amountMm: obj.amountMm,
  //             amountPre: obj.amountPre,
  //             weight: null,
  //             action: obj.action
  //         }).then(function(docRef) {
  //             console.log("Document written with ID: ", docRef.id);
  //         })
  //         .catch(function(error) {
  //             console.error("Error adding document: ", error);
  //         });
  //     });

  // })
}

//signup
const signupForm = document.querySelector(".signup");
signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = signupForm.email.value;
  const password = signupForm.password.value;
  createUserWithEmailAndPassword(auth, email, password)
    .then((cred) => {
      // console.log("user created: ", cred.user)
      signupForm.reset();

      //create user db
      setDoc(doc(db, "user", cred.user.uid), {
        email: cred.user.email,
      }).then(() => {});
    })
    .catch((err) => {
      alert(err.message);
    });
});

//login
const loginForm = document.querySelector(".login");
loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = loginForm.email.value;
  const password = loginForm.password.value;
  signInWithEmailAndPassword(auth, email, password)
    .then((cred) => {
      // console.log("user logged in:",cred.user)
    })
    .catch((err) => {
      alert(err.message);
    });
});

//logout
const logoutButton = document.querySelector(".logout");
logoutButton.addEventListener("click", (e) => {
  e.preventDefault();

  signOut(auth)
    .then(() => {
      // console.log("user signed out")
    })
    .catch((err) => {
      console.log(err);
    });
});

//auth state subscription
onAuthStateChanged(auth, (user) => {
  console.log("user status changed", user);
  if (user == null) {
    document.querySelector(".content").style.display = "none";
    document.querySelector(".auth").style.display = "block";
  } else {
    document.querySelector(".content").style.display = "block";
    document.querySelector(".auth").style.display = "none";
    initCRUD(user);
  }
});

window.addEventListener("load", () => {
  var now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  /* remove second/millisecond if needed - credit ref. https://stackoverflow.com/questions/24468518/html5-input-datetime-local-default-value-of-today-and-current-time#comment112871765_60884408 */
  now.setMilliseconds(null);
  now.setSeconds(null);

  let cals = document.getElementsByClassName("cal");
  for (let i = 0; i < cals.length; i++) {
    cals[i].value = now.toISOString().slice(0, -1);
  }
});


