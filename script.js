async function getUser() {
  const username = document.getElementById("usernameInput").value;
  const resultDiv = document.getElementById("result");

  if (!username) {
    alert("Please enter a username.");
    return;
  }

  try {
    const res = await fetch(`https://api.github.com/users/${username}`);
    if (!res.ok) throw new Error("User not found");

    const data = await res.json();

    document.getElementById("avatar").src = data.avatar_url;
    document.getElementById("name").textContent = data.name || "No name available";
    document.getElementById("bio").textContent = data.bio || "No bio available";
    document.getElementById("repos").textContent = data.public_repos;
    document.getElementById("followers").textContent = data.followers;
    document.getElementById("profileLink").href = data.html_url;

    resultDiv.classList.remove("hidden");

  } catch (error) {
    resultDiv.classList.add("hidden");
    alert("GitHub user not found!");
  }
}
