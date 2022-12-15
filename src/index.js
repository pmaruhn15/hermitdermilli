import { initializeApp} from 'firebase/app'
import { 
    getFirestore,collection,onSnapshot,
    addDoc, deleteDoc, doc, setDoc,
    query,where, orderBy,
    getDoc,updateDoc, limit
} from 'firebase/firestore'
import { 
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword, signOut,
    onAuthStateChanged
} from 'firebase/auth'

import { enableIndexedDbPersistence } from "firebase/firestore"; 

import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

const firebaseConfig = {
    apiKey: "AIzaSyDArEFma0YPjyU8swmi-0oSERYE3EAJAhY",
    authDomain: "milchmonitor.firebaseapp.com",
    databaseURL: "https://milchmonitor-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "milchmonitor",
    storageBucket: "milchmonitor.appspot.com",
    messagingSenderId: "915032184931",
    appId: "1:915032184931:web:6b114bee8523636bab8056"
};
//init app
initializeApp(firebaseConfig)

//init services
const db = getFirestore()
const auth = getAuth()

enableIndexedDbPersistence(db)
  .catch((err) => {
      if (err.code == 'failed-precondition') {
          // Multiple tabs open, persistence can only be enabled
          // in one tab at a a time.
          // ...
      } else if (err.code == 'unimplemented') {
          // The current browser does not support all of the
          // features required to enable persistence
          // ...
      } else {
        console.log("sucessfully set up persistence")
      }
  });
// Subsequent queries will use persistence, if it was enabled successfully


//Service Worker
if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js')
    .then((reg) => {
        console.log("service worker registered",reg)
    })
    .catch((err) => {
        console.log("service worker not registered", err.message)
    })
}

function initCRUD(user) {
    //collection ref
    const colRef = collection(db,'user',user.uid,"data")

    //queries
    const q = query(colRef, orderBy('date','desc'))
    const i = query(colRef, orderBy('date','asc'))
    const lastfed = query(colRef, where("action", "==", "Stillen"), orderBy('date','desc'), limit(1))

    onSnapshot(lastfed, (snapshot) => {
        snapshot.docs.forEach((doc) => {
            let lastfedtime = new Date(doc.data().date.seconds*1000)
            let elapsedtime = new Date() - lastfedtime - 3600000
            document.getElementById("lastfed").innerHTML = "letztes Stillen: " + lastfedtime.toLocaleString() + " --- Zeit vergangen: " + new Date(elapsedtime).toLocaleTimeString()
        })
    })

    //charts
    onSnapshot(i, (snapshot) => {
        let data = []
        snapshot.docs.forEach((doc) => {
            data.push({ ...doc.data(), id: doc.id , day: new Date(doc.data().date.seconds*1000).toDateString()})
        })
        console.log(data)
          
          var result = [];
          data.reduce(function(res, value) {
            if (!res[value.day]) {
              res[value.day] = { day: value.day, amount: 0 };
              result.push(res[value.day])
            }
            res[value.day].amount += value.amount;
            return res;
          }, {});

          

        const ctx = document.getElementById('chart').getContext('2d');
        let chartStatus = Chart.getChart("chart");
        if (chartStatus != undefined) {
            chartStatus.destroy();
        }
        new Chart(
            ctx,
            {
              type: 'bar',
              data: {
                labels: result.map(row =>row.day),
                datasets: [
                  {
                    label: 'Abgepumpte Milch',
                    data: result.map(row => row.amount)
                  }
                ]
              },
            }
          );


          var result2 = [];
          data.reduce(function(res, value) {
            if (!res[value.day]) {
              res[value.day] = { day: value.day, count: 0 };
              result2.push(res[value.day])
            }
            if (value.action == "Pumpen") {
                res[value.day].count += 1;
            }
            return res;
          }, {});

          const ctx2 = document.getElementById('chart_pump_frequ').getContext('2d');
        let chartStatus2 = Chart.getChart("chart_pump_frequ");
        if (chartStatus2 != undefined) {
            chartStatus2.destroy();
        }
        new Chart(
            ctx2,
            {
              type: 'bar',
              data: {
                labels: result2.map(row =>row.day),
                datasets: [
                  {
                    label: 'Gepumpt pro Tag',
                    data: result2.map(row => row.count)
                  }
                ]
              },
            }
          );
        

    })

    //real time collection data
    onSnapshot(q, (snapshot) => {
        var mytable = "<table>";
        mytable += "<tr><td>Uhrzeit</td><td>Datum</td><td>Aktion</td><td>Muttermilch</td><td>PreMilch</td><td>Pumpen</td><td>Gewicht</td></tr>";
        snapshot.docs.forEach((doc) => {
            mytable += "<tr>";
            mytable += "<td>" +new Date(doc.data().date.seconds*1000).toLocaleTimeString('de-de')  + "</td>";
            mytable += "<td>" +new Date(doc.data().date.seconds*1000).toLocaleDateString('de-de', { weekday:"long", year:"numeric", month:"short", day:"numeric"})  + "</td>";
            mytable += "<td>" + doc.data().action + "</td>";
            mytable += (doc.data().amountMm === null) ? '<td></td>' : "<td>" + doc.data().amountMm + "</td>";
            mytable += (doc.data().amountPre === null) ? '<td></td>' : "<td>" + doc.data().amountPre + "</td>";
            mytable += (doc.data().amount === null) ? '<td></td>' : "<td>" + doc.data().amount + "</td>";
            mytable += (doc.data().weight === null) ? '<td></td>' : "<td>" + doc.data().weight + "</td>";
            mytable += "<td><button class='update-button' data-id="+doc.id+">ändern<i class='fa-solid fa-pen'></i></button></td>";
            mytable += "<td><button class='delete-button' data-id="+doc.id+">entfernen<i class='fa-solid fa-trash'></i></button></td>";
            mytable += "</tr>";
        })
        mytable += "</table>";
        document.getElementById("table").innerHTML = mytable;
        
        // add update function to delete buttons
        var btns = document.getElementsByClassName("update-button");
        for (let i = 0; i < btns.length; i++) {
            btns[i].addEventListener("click", function (btn) {
                //get document
                const docRef = doc(colRef, btn.originalTarget.dataset.id)
                getDoc(docRef)
                .then((doc) => {
                    if (doc.data().action == "Pumpen") {
                        var updateForm = document.getElementById("update")
                        updateForm.style.display = "block"
                        updateForm.date.setAttribute("value",new Date(doc.data().date.seconds*1000))
                        updateForm.amount.setAttribute("value",doc.data().amount)
                        updateForm.setAttribute("data-id", doc.id)
                    }
                    if (doc.data().action == "Stillen") {
                        var updateForm = document.getElementById("updateFeed")
                        updateForm.style.display = "block"
                        updateForm.date.setAttribute("value",new Date(doc.data().date.seconds*1000))
                        updateForm.amountMm.setAttribute("value",doc.data().amountMm)
                        updateForm.amountPre.setAttribute("value",doc.data().amountPre)
                        updateForm.setAttribute("data-id", doc.id)
                    }
                    if (doc.data().action == "Wiegen") {
                        var updateForm = document.getElementById("updateWeight")
                        updateForm.style.display = "block"
                        updateForm.date.setAttribute("value",new Date(doc.data().date.seconds*1000))
                        updateForm.weight.setAttribute("value",doc.data().weight)
                        updateForm.setAttribute("data-id", doc.id)
                    }
                })
            });
        }

        // add delete function to delete buttons
        var btns = document.getElementsByClassName("delete-button");
        for (let i = 0; i < btns.length; i++) {
            btns[i].addEventListener("click", function (btn) {
                const docRef = doc(colRef, btn.originalTarget.dataset.id)
                deleteDoc(docRef)
            });
        }


    })

    //adding documents Pumpen
    const addPumpForm = document.querySelector('.add')
    // addPumpForm[0].setAttribute("value", new Date()); //set current time in input form
    addPumpForm.addEventListener('submit', (e) => {
        e.preventDefault()

        addDoc(colRef,{
            date: new Date(addPumpForm.date.value),
            amount: Number(addPumpForm.amount.value),
            amountMm: null,
            amountPre: null,
            weight: null,
            action: "Pumpen"
        })
        .then(() => {
            addPumpForm.reset()
            addPumpForm[0].setAttribute("value", new Date()); //set current time in input form
        })
    })

    //adding documents Stillen
    const addFeedForm = document.querySelector('.addFeed')
    addFeedForm[0].setAttribute("value", new Date()); //set current time in input form
    addFeedForm.addEventListener('submit', (e) => {
        e.preventDefault()

        addDoc(colRef,{
            date: new Date(addFeedForm.date.value),
            amount: null,
            amountMm: Number(addFeedForm.amountMm.value),
            amountPre: Number(addFeedForm.amountPre.value),
            weight: null,
            action: "Stillen"
        })
        .then(() => {
            addFeedForm.reset()
            addFeedForm[0].setAttribute("value", new Date()); //set current time in input form
        })
    })

    //adding documents Gewicht
    const addWeightForm = document.querySelector('.addWeight')
    addWeightForm[0].setAttribute("value", new Date()); //set current time in input form
    addWeightForm.addEventListener('submit', (e) => {
        e.preventDefault()

        addDoc(colRef,{
            date: new Date(addWeightForm.date.value),
            amount: null,
            amountMm: null,
            amountPre: null,
            weight: Number(addWeightForm.weight.value),
            action: "Wiegen"
        })
        .then(() => {
            addWeightForm.reset()
            addWeightForm[0].setAttribute("value", new Date()); //set current time in input form
        })
    })

    //updating documents
    const updateForm = document.querySelector('#update')
    updateForm.addEventListener('submit', (e) => {
        e.preventDefault()

        const docRef = doc(colRef, updateForm.dataset.id)
        updateDoc(docRef, {
            date: new Date(updateForm.date.value),
            amount: Number(updateForm.amount.value)
        })
        .then(() => {
            updateForm.style.display = "none"
        })
    })
    const updateFeedForm = document.querySelector('#updateFeed')
    updateFeedForm.addEventListener('submit', (e) => {
        e.preventDefault()

        const docRef = doc(colRef, updateFeedForm.dataset.id)
        updateDoc(docRef, {
            date: new Date(updateFeedForm.date.value),
            amountMm: Number(updateFeedForm.amountMm.value),
            amountPre: Number(updateFeedForm.amountPre.value)
        })
        .then(() => {
            updateFeedForm.style.display = "none"
        })
    })
    const updateWeightForm = document.querySelector('#updateWeight')
    updateWeightForm.addEventListener('submit', (e) => {
        console.log()
        const docRef = doc(colRef, updateWeightForm.dataset.id)
        updateDoc(docRef, {
            date: new Date(updateWeightForm.date.value),
            weight: Number(updateWeightForm.weight.value)
        })
        .then(() => {
            updateWeightForm.style.display = "none"
        })
    })


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
const signupForm = document.querySelector('.signup')
signupForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const email = signupForm.email.value
    const password = signupForm.password.value
    createUserWithEmailAndPassword(auth, email, password)
    .then((cred) => {
        // console.log("user created: ", cred.user)
        signupForm.reset()

        //create user db
        setDoc(doc(db, "user", cred.user.uid), {
            email : cred.user.email
          })
        .then(() => {
            
        })

    })
    .catch((err => {
        alert(err.message)
    }))
})

//login
const loginForm = document.querySelector('.login')
loginForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const email = loginForm.email.value
    const password = loginForm.password.value
    signInWithEmailAndPassword(auth, email, password)
    .then((cred) =>{
        // console.log("user logged in:",cred.user)
    })
    .catch((err) => {
        alert(err.message)
    })
})

//logout
const logoutButton = document.querySelector('.logout')
logoutButton.addEventListener('click', (e) => {
    e.preventDefault()

    signOut(auth)
    .then(() => {
        // console.log("user signed out")
    })
    .catch((err) => {
        console.log(err)
    })
})

//auth state subscription
onAuthStateChanged(auth, (user) =>{
    console.log("user status changed", user)
    if (user == null) {
        document.querySelector('.content').style.display = "none"
        document.querySelector('.auth').style.display = "block"
    } else {
        document.querySelector('.content').style.display = "block"
        document.querySelector('.auth').style.display = "none"
        initCRUD(user)
    }
})


window.addEventListener('load', () => {
    var now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  
    /* remove second/millisecond if needed - credit ref. https://stackoverflow.com/questions/24468518/html5-input-datetime-local-default-value-of-today-and-current-time#comment112871765_60884408 */
    now.setMilliseconds(null)
    now.setSeconds(null)
  
    let cals = document.getElementsByClassName('cal')
    for (let i = 0; i < cals.length; i++) {
        cals[i].value = now.toISOString().slice(0, -1);
      }
  });


var data_to_upload = [
    {
      "date": "2022-11-29 11:13",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-11-29 10:56",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-29 12:10",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-29 14:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-11-29 14:55",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-29 15:40",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-29 16:08",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-29 16:25",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-11-29 17:25",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-29 18:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-11-29 19:15",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 10,
      "amount": null
    },
    {
      "date": "2022-11-29 23:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 15,
      "amount": null
    },
    {
      "date": "2022-11-30 03:15",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 04:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-11-30 06:30",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 07:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 09:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-11-30 09:50",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-11-30 10:00",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 11:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-11-30 12:15",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-11-30 12:50",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-11-30 15:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 15:35",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-11-30 17:00",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 17:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-11-30 18:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-11-30 18:15",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 19:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-11-30 20:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-11-30 21:49",
      "action": "Stillen",
      "amountMm": 30,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-11-30 22:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 01:15",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 01:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 04:00",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 07:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 10:00",
      "action": "Stillen",
      "amountMm": 40,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 11:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 11:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 12:35",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 13:18",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 14:30",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 15:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 17:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 19:50",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-01 22:55",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-01 02:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-01 07:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 40
    },
    {
      "date": "2022-12-01 12:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-01 14:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-01 20:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-01 23:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-02 02:05",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-02 04:15",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-02 06:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-02 09:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-02 11:45",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-02 14:45",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-02 17:00",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-02 17:45",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-02 19:10",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-02 23:20",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-02 02:35",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-02 03:15",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-02 04:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-02 11:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-02 12:45",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-02 15:10",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-02 18:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-02 21:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-03 02:00",
      "action": "Stillen",
      "amountMm": 35,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-03 04:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-03 07:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-03 10:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-03 10:45",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-03 12:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-03 13:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-03 14:30",
      "action": "Stillen",
      "amountMm": 35,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-03 16:45",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-03 18:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-03 19:30",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-03 22:50",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-03 02:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 35
    },
    {
      "date": "2022-12-03 14:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 35
    },
    {
      "date": "2022-12-03 19:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-03 22:50",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-04 02:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-04 03:50",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 04:55",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 07:00",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-04 08:30",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 10:25",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 12:20",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-04 13:55",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 15:20",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-04 18:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 19:45",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": 10,
      "amount": null
    },
    {
      "date": "2022-12-04 23:30",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-04 03:28",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-04 04:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-04 09:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-04 11:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-04 13:10",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-04 14:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-04 16:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-04 18:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-04 22:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 45
    },
    {
      "date": "2022-12-05 00:20",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-05 03:00",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 05:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-05 07:55",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-05 10:30",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 12:30",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 14:00",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 16:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 17:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-05 18:45",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 22:15",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-05 01:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-05 09:55",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 40
    },
    {
      "date": "2022-12-05 12:15",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-05 13:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-05 14:50",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-05 17:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-05 20:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-05 22:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-06 01:15",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-06 04:10",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-06 06:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-06 09:20",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-06 11:50",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-06 14:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-06 17:45",
      "action": "Stillen",
      "amountMm": 40,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-06 19:25",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-06 22:00",
      "action": "Stillen",
      "amountMm": 40,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-06 05:04",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-06 10:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-06 15:05",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-06 17:15",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-06 20:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 40
    },
    {
      "date": "2022-12-06 23:26",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-07 00:30",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 01:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-07 04:30",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 06:30",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 07:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 08:50",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 09:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-07 12:30",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 15:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 17:00",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-07 18:50",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-07 22:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 15,
      "amount": null
    },
    {
      "date": "2022-12-07 01:38",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-07 05:26",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-07 08:38",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-07 11:26",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 45
    },
    {
      "date": "2022-12-07 13:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-07 15:53",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-07 19:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-07 22:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-08 00:55",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-08 04:00",
      "action": "Stillen",
      "amountMm": 30,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-08 07:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-08 08:40",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-08 09:20",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-08 11:20",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-08 12:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-08 15:30",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-08 19:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-08 03:38",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 30
    },
    {
      "date": "2022-12-08 08:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-08 08:55",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-08 11:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-08 14:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-08 15:49",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-08 21:45",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-09 00:55",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-09 04:00",
      "action": "Stillen",
      "amountMm": 30,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-09 06:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 08:35",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-09 09:20",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 10:40",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 14:50",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 15:48",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 18:45",
      "action": "Stillen",
      "amountMm": 30,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-09 19:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 22:15",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-09 02:00",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 30
    },
    {
      "date": "2022-12-09 08:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-09 10:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-09 13:05",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-09 16:50",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 30
    },
    {
      "date": "2022-12-09 19:38",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-09 23:39",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-10 01:40",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-10 02:00",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": 15,
      "amount": null
    },
    {
      "date": "2022-12-10 06:15",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": 15,
      "amount": null
    },
    {
      "date": "2022-12-10 09:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-10 11:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-10 12:50",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-10 14:35",
      "action": "Stillen",
      "amountMm": 15,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-10 17:18",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-10 18:40",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 10,
      "amount": null
    },
    {
      "date": "2022-12-10 20:30",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 60,
      "amount": null
    },
    {
      "date": "2022-12-10 23:50",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-10 01:55",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-10 02:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-10 07:04",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-10 11:25",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-10 15:10",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-10 19:15",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 15
    },
    {
      "date": "2022-12-10 21:27",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-10 22:11",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 25
    },
    {
      "date": "2022-12-11 02:05",
      "action": "Stillen",
      "amountMm": 50,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 06:14",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 27
    },
    {
      "date": "2022-12-11 09:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 12
    },
    {
      "date": "2022-12-11 13:35",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 23
    },
    {
      "date": "2022-12-11 17:02",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 22
    },
    {
      "date": "2022-12-11 05:00",
      "action": "Stillen",
      "amountMm": 40,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 07:00",
      "action": "Stillen",
      "amountMm": 27,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-11 09:15",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 25,
      "amount": null
    },
    {
      "date": "2022-12-11 12:00",
      "action": "Stillen",
      "amountMm": 12,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-11 16:30",
      "action": "Stillen",
      "amountMm": 23,
      "amountPre": 60,
      "amount": null
    },
    {
      "date": "2022-12-11 18:44",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 19:59",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-11 20:31",
      "action": "Stillen",
      "amountMm": 22,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 20:31",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 20:32",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 22
    },
    {
      "date": "2022-12-11 21:07",
      "action": "Stillen",
      "amountMm": 22,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 21:32",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 11
    },
    {
      "date": "2022-12-11 22:13",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-11 22:14",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-11 22:58",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 5,
      "amount": null
    },
    {
      "date": "2022-12-11 23:35",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 14
    },
    {
      "date": "2022-12-11 00:33",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-11 02:30",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-12 01:42",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 14,
      "amount": null
    },
    {
      "date": "2022-12-12 02:39",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-12 07:15",
      "action": "Stillen",
      "amountMm": 20,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 07:16",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-12 07:33",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 18
    },
    {
      "date": "2022-12-12 09:31",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-12 09:31",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 10:03",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 12
    },
    {
      "date": "2022-12-12 10:29",
      "action": "Stillen",
      "amountMm": 12,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 11:28",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-12 11:56",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 17
    },
    {
      "date": "2022-12-12 12:13",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 15:12",
      "action": "Stillen",
      "amountMm": 29,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 15:13",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 16:45",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 13
    },
    {
      "date": "2022-12-12 16:58",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 17
    },
    {
      "date": "2022-12-12 17:48",
      "action": "Stillen",
      "amountMm": 30,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 18:15",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 13
    },
    {
      "date": "2022-12-12 19:19",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 21
    },
    {
      "date": "2022-12-12 19:58",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 18
    },
    {
      "date": "2022-12-12 20:29",
      "action": "Stillen",
      "amountMm": 35,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 21:13",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-12 22:35",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 27
    },
    {
      "date": "2022-12-12 23:33",
      "action": "Stillen",
      "amountMm": 18,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 00:40",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 20
    },
    {
      "date": "2022-12-13 01:18",
      "action": "Stillen",
      "amountMm": 27,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 04:00",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 04:39",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 22
    },
    {
      "date": "2022-12-13 05:22",
      "action": "Stillen",
      "amountMm": 42,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 05:47",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 12
    },
    {
      "date": "2022-12-13 06:46",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 7
    },
    {
      "date": "2022-12-13 09:38",
      "action": "Stillen",
      "amountMm": 19,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 09:41",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-13 10:24",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 27
    },
    {
      "date": "2022-12-13 11:15",
      "action": "Stillen",
      "amountMm": 27,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 11:19",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 11:38",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-13 12:48",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 13:55",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 28
    },
    {
      "date": "2022-12-13 15:02",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 16
    },
    {
      "date": "2022-12-13 15:25",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 8
    },
    {
      "date": "2022-12-13 15:26",
      "action": "Stillen",
      "amountMm": 28,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 16:08",
      "action": "Stillen",
      "amountMm": 24,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 18:07",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-13 19:20",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 10
    },
    {
      "date": "2022-12-13 19:21",
      "action": "Stillen",
      "amountMm": 10,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-13 19:21",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-13 22:11",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 60,
      "amount": null
    },
    {
      "date": "2022-12-14 01:52",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 45
    },
    {
      "date": "2022-12-14 03:09",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 52
    },
    {
      "date": "2022-12-14 08:40",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 08:41",
      "action": "Stillen",
      "amountMm": 27,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 11:05",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 34
    },
    {
      "date": "2022-12-14 11:27",
      "action": "Stillen",
      "amountMm": 25,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 11:28",
      "action": "Stillen",
      "amountMm": 9,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 15:58",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-14 16:18",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 32
    },
    {
      "date": "2022-12-14 18:01",
      "action": "Stillen",
      "amountMm": 32,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 18:34",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 26
    },
    {
      "date": "2022-12-14 20:26",
      "action": "Stillen",
      "amountMm": 26,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 20:26",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": 30,
      "amount": null
    },
    {
      "date": "2022-12-14 20:26",
      "action": "Stillen",
      "amountMm": null,
      "amountPre": null,
      "amount": null
    },
    {
      "date": "2022-12-14 21:02",
      "action": "Pumpen",
      "amountMm": null,
      "amountPre": null,
      "amount": 17
    }
  ]