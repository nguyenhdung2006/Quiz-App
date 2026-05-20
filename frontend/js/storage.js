function save() {

localStorage.setItem("vocab", JSON.stringify(vocab));
localStorage.setItem("wrongWords", JSON.stringify(wrongWords));

}