const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create sample tasks
  const taskA = await prisma.task.create({
    data: {
      system: "FOL",
      taskName: "Pre-deploy DB backup",
      description: "Take full database snapshot before deployment",
      assignedTeam: "DBA",
      status: "Pending",
    },
  });

  const taskB = await prisma.task.create({
    data: {
      system: "SAP GW",
      taskName: "Deploy SAP Gateway service",
      description: "Deploy updated OData services to SAP Gateway",
      assignedTeam: "SAP Basis",
      status: "Pending",
    },
  });

  const taskC = await prisma.task.create({
    data: {
      system: "Fiserv",
      taskName: "Post-deploy smoke test",
      description: "Run end-to-end smoke tests against Fiserv integration",
      assignedTeam: "QA",
      status: "Pending",
    },
  });

  // taskC depends on taskA and taskB
  await prisma.taskDependency.createMany({
    data: [
      { taskId: taskC.id, dependsOnTaskId: taskA.id },
      { taskId: taskC.id, dependsOnTaskId: taskB.id },
    ],
  });

  console.log("Seeded 3 tasks with dependencies");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
