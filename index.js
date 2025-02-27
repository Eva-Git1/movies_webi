import express from 'express';
import EventEmitter from 'node:events';

import moviesRouter from './routes/moviesRouter.js';
import MoviesModel from './models/moviesModel.js';

import 'dotenv/config';

import connectDB from 'connectDB';

import mongoose from 'mongoose';

const movieEventEmitter = new EventEmitter();

movieEventEmitter.on('error', (error) => {
	console.error("Erreur globale de l'EventEmitter :", error);
});

movieEventEmitter.on('saveMovies', async (movies) => {
	for (const movie of movies) {
		try {
			const result = await MoviesModel.createOne(movie);
			console.log('Film traité :', movie.title, result);
		} catch (error) {
			console.error(
				'Erreur lors de la sauvegarde du film',
				movie.title,
				error
			);
		}
	}
	console.log('Tous les films ont été traités.');
});

const app = express();

let totalRequest = 0;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use((req, res, next) => {
	totalRequest++;
	next();
});

app.get('/', (request, response) => {
	response.status(200).json({ message: 'Vous nous avez contacté :)' });
});

app.get('/query-movies/:query', async (request, response) => {
	try {
		const { query } = request.params;
		const { page } = request.query;
		const pageForTMDB = page || 1;

		const url = `https://api.themoviedb.org/3/search/movie?query=${query}&include_adult=false&language=fr-FR&page=${pageForTMDB}`;
		const options = {
			method: 'GET',
			headers: {
				accept: 'application/json',
				Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
			},
		};

		const responseFromTMDB = await fetch(url, options);

		if (!responseFromTMDB.ok) {
			throw new Error(
				`Erreur de TMDB : ${responseFromTMDB.status} ${responseFromTMDB.statusText}`
			);
		}

		const data = await responseFromTMDB.json();

		// Émettre un événement avec la liste complète des films
		movieEventEmitter.emit('saveMovies', data.results);

		response
			.status(200)
			.json({ message: `Vous avez cherché le film ${query}`, data });
	} catch (error) {
		console.error('Erreur dans la route /query-movies:', error);
		response.status(500).json({ error: 'Erreur interne du serveur' });
	}
});

app.use('/movies', moviesRouter);

app.use((req, res) => {
	res.status(404).json({ error: true, message: 404 });
});

app.listen(3000, () => {
	console.log('server running : port 3000');
});
