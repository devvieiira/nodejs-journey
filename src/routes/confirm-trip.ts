import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getMailClient } from "../lib/mail";
import nodemailer from "nodemailer";

export async function confirmTrip(app: FastifyInstance) {
	app.withTypeProvider<ZodTypeProvider>().get(
		"/trips/:tripId/confirm",
		{
			schema: {
				params: z.object({
					tripId: z.string().uuid(),
				}),
			},
		},
		async (req, reply) => {
			const { tripId } = req.params;

			const trip = await prisma.trip.findUnique({
				where: {
					id: tripId,
				},
				include: {
					participants: {
						where: {
							is_owner: false,
						},
					},
				},
			});

			if (!trip) {
				throw new Error("Trip not found.");
			}

			if (trip.is_confirmed) {
				return reply.redirect(`http://localhost:3333/trips/${tripId}`);
			}

			await prisma.trip.update({
				where: { id: tripId },
				data: {
					is_confirmed: true,
				},
			});

			const formattedStartsAt = dayjs(trip.starts_at).format("LL");
			const formattedEndsAt = dayjs(trip.ends_at).format("LL");

			const mail = await getMailClient();

			await Promise.all(
				trip.participants.map(async (participant) => {
					const confirmationLink = `https://localhost:4000/participants/${participant.id}/confirm`;

					const msg = await mail.sendMail({
						from: {
							name: "Equipe plann.er",
							address: "nJ9wA@example.com",
						},
						to: participant.email,
						subject: `Confirme sua presença na viagem para ${trip.destination} em ${formattedStartsAt}!`,
						html: `
						<div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
							<p>Você foi convidado para participar de uma viagem para <strong>${trip.destination}</strong> nas datas <strong>${formattedStartsAt}</strong> até <strong>${formattedEndsAt}</strong>.</p>
							<p></p>
							<p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
							<p></p>
								<a href="${confirmationLink}">Confirmar viagem</a>
							<p></p>
							<p>Caso você não saiba do que se trata esse e-mail, apenas ignore.</p>
						</div>
						`.trim(),
					});

					console.log(nodemailer.getTestMessageUrl(msg));
				}),
			);

			return reply.redirect(`http://localhost:3000/trips/${tripId}`);
		},
	);
}
