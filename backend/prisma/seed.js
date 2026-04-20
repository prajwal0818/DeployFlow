const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create projects
  const projectA = await prisma.project.create({
    data: {
      name: "Q3 Production Release",
      code: "Q3-PROD",
      description: "Q3 production deployment cycle",
    },
  });

  const projectB = await prisma.project.create({
    data: {
      name: "Platform Migration",
      code: "PLAT-MIG",
      description: "Platform migration from legacy to cloud",
    },
  });

  // Create tasks for project A
  const taskA1 = await prisma.task.create({
    data: {
      system: "FOL",
      taskName: "Pre-deploy DB backup",
      description: "Take full database snapshot before deployment",
      assignedTeam: "DBA",
      status: "Pending",
      projectId: projectA.id,
      sequenceNumber: 1,
    },
  });

  const taskA2 = await prisma.task.create({
    data: {
      system: "SAP GW",
      taskName: "Deploy SAP Gateway service",
      description: "Deploy updated OData services to SAP Gateway",
      assignedTeam: "SAP Basis",
      status: "Pending",
      projectId: projectA.id,
      sequenceNumber: 2,
    },
  });

  const taskA3 = await prisma.task.create({
    data: {
      system: "Fiserv",
      taskName: "Post-deploy smoke test",
      description: "Run end-to-end smoke tests against Fiserv integration",
      assignedTeam: "QA",
      status: "Pending",
      projectId: projectA.id,
      sequenceNumber: 3,
    },
  });

  // taskA3 depends on taskA1 and taskA2 (within same project)
  await prisma.taskDependency.createMany({
    data: [
      { taskId: taskA3.id, dependsOnTaskId: taskA1.id },
      { taskId: taskA3.id, dependsOnTaskId: taskA2.id },
    ],
  });

  // Create tasks for project B
  const taskB1 = await prisma.task.create({
    data: {
      system: "AWS",
      taskName: "Provision cloud infrastructure",
      description: "Set up VPC, subnets, and EC2 instances",
      assignedTeam: "Cloud Ops",
      status: "Pending",
      projectId: projectB.id,
      sequenceNumber: 1,
    },
  });

  const taskB2 = await prisma.task.create({
    data: {
      system: "AWS",
      taskName: "Migrate database to RDS",
      description: "Migrate on-prem PostgreSQL to AWS RDS",
      assignedTeam: "DBA",
      status: "Pending",
      projectId: projectB.id,
      sequenceNumber: 2,
    },
  });

  // taskB2 depends on taskB1 (within same project)
  await prisma.taskDependency.createMany({
    data: [
      { taskId: taskB2.id, dependsOnTaskId: taskB1.id },
    ],
  });

  console.log("Seeded 2 projects with 5 tasks and dependencies");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
