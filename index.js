// Change the ES Module import statement into a classic require statement:
const { setServers } = require("node:dns/promises");

// Run your DNS bypass logic exactly the same way
setServers(["1.1.1.1", "8.8.8.8"]);
// enviornment config
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const mongoose = require("mongoose");

const token = process.env.TELEGRAM_BOT_TOKEN;
const mongodb = process.env.MONGODB_URL;

if (!token || !mongodb) {
  console.error("error");
  process.exit(1); 
}

// mongodb connection
mongoose.connect(mongodb).then(() => console.log("COnnected successfully to MongoDB Atlas")).catch(err => console.error("Database connection error", err));

// data schema definition

const taskSchema = new mongoose.Schema({
    userId: {type: Number, required: true},
    text: {type: String, required:true},
    completed: {type:Boolean, default: false},
    createdAt: {type: Date, default: Date.now}
});

const Task = mongoose.model("Task", taskSchema);

const bot = new Telegraf(token);

//start command
bot.command('start', (ctx) =>{
    ctx.reply(`Welcome ${ctx.from.first_name || 'there'}! Use /add to create new tasks and /list to manage them.`);
});

//add command
bot.command('add', async (ctx) => {
    const taskText = ctx.payload?.trim();

    if(!taskText) {
        return ctx.reply("Please provide a task. Use /add to add a task")
    }

    try {
        const newTask = new Task({
            userId: ctx.from.id,
            text: taskText
        });

        await newTask.save();

        ctx.reply(`Saved to database: ${taskText}`);
    } catch (error){
        console.error("Error: ", error);
        ctx.reply("Failed to save the task");
    }
});

//list command

bot.command('list', async (ctx) => {

    try {
        const tasks = await Task.find({
            userId: ctx.from.id, completed: false
        });

        if(tasks.length === 0){
            return ctx.reply("Your to do list is empty. Use /add to create one.");
        }

        ctx.reply("Your current tasks: ");

        for (const task of tasks){
            await ctx.reply(
                `⏳ ${task.text}`,
                Markup.inlineKeyboard([
                    Markup.button.callback("Complete", `complete_${task._id}`),
                    Markup.button.callback("Delete", `delete_${task._id}`)
                ])
            );
        }

    } catch (error) {
        console.error("Database query error: ", error);
        ctx.reply("Could not retrieve your tasks");
    }
});


// button interaction handlers

bot.action(/^complete_/, async (ctx) => {
    const taskId = ctx.match.input.split('_')[1];

    try {
        await Task.findByIdAndUpdate(taskId, {completed:true});

        await ctx.answerCbQuery("Task marked as completed");
        await ctx.editMessageText("Task completed");
    } catch (error) {
        console.error(error);
        await ctx.answerCbQuery("Error updating task");
    }
});

bot.action(/^delete_/, async (ctx) => {
    const taskId = ctx.match.input.split('_')[1];

    try {
        await Task.findByIdAndDelete(taskId);

        await ctx.answerCbQuery("Task deleted permanently.");
        await ctx.editMessageText("Task removed.");
    } catch (error) {
        console.error(error);
        await ctx.answerCbQuery("Error deleting task");
    }
});

// Tell Telegraf to start listening via Long Polling
bot.launch()
  .then(() => console.log('Bot is up and running safely via Long Polling...'))
  .catch((err) => console.error('Failed to launch the bot:', err));

// Enable graceful stop for your server processes
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
