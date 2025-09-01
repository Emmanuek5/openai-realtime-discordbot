const { REST, Routes } = require("discord.js");
require("dotenv").config();

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
const clientId = process.env.CLIENT_ID;

const commandIdOrAll = process.argv[2];

if (!commandIdOrAll) {
  console.log('Please provide a command ID, name, or the parameter "all"');
} else if (commandIdOrAll === "all") {
  console.log("Deleting all application commands");

  rest
    .get(Routes.applicationCommands(clientId))
    .then((commands: any) => {
      if (!commands.length) {
        console.log("No commands to delete");
        return;
      }

      const deletePromises = commands.map((command:any) =>
        rest.delete(Routes.applicationCommand(clientId, command.id))
      );

      return Promise.all(deletePromises);
    })
    .then(() => console.log("Successfully deleted all application commands"))
    .catch(console.error);
} else {
  console.log("Deleting command by ID or name");
  rest
    .get(Routes.applicationCommands(clientId))
    .then((commands:any ) => {
      const command = commands.find(
        (cmd:any) => cmd.id === commandIdOrAll || cmd.name === commandIdOrAll
      );

      if (!command) {
        console.log("Command not found");
        return;
      }

      return rest.delete(Routes.applicationCommand(clientId, command.id));
    })
    .then(() => console.log("Successfully deleted application command"))
    .catch(console.error);
}