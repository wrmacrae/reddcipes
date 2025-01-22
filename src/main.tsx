// Learn more at developers.reddit.com/docs
import { Devvit, RedditAPIClient, RedisClient, useForm, useState, useAsync } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
});

async function makeRecipePost(redis: RedisClient, reddit: RedditAPIClient, title: string, picture: string, ingredients: string, intro: string, instructions: string) {
  const subredditName = (await reddit.getCurrentSubreddit()).name
  const post = await reddit.submitPost({
    title: title,
    subredditName: subredditName,
    preview: (
      <vstack>
        <text color="black white">Loading...</text>
      </vstack>
    ),
  });
  await redis.hSet(post.id, { title: title, picture: picture, ingredients: ingredients, instructions: instructions })
  return post.id
}

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: "Post a New Recipe",
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    const { reddit, ui } = context;
    ui.showForm(postForm);
 },
});

function formatIntro(intro: string) {
  return intro != "" ?
    <vstack backgroundColor='transparent' borderColor='primary' cornerRadius='small' width="93%" padding='small'>
      <text wrap color='primary' alignment='center middle' weight='bold'>{intro}</text>
    </vstack>
    : <vstack/>
}

function formatIngredients(ingredients: string) {
  return <vstack maxHeight="75%">
      {ingredients.split("\n").map((ingredient: string) => <text size="medium" wrap>{ "- " + ingredient}</text>)}
    </vstack>
}

function formatInstructions(instructions: string) {
  return <vstack maxHeight="90%">
      {Array.from(instructions.split("\n").entries()).map((value: [number, string]) =>
      <vstack>
        <hstack>
        <text weight='bold' size="large" wrap>{(value[0] + 1) + ". "}</text>
        <spacer shape='thin' size='xsmall'></spacer>
        <text size='medium' wrap>{value[1]}</text>
        </hstack>
      <spacer shape='thin' size='xsmall'></spacer>
      </vstack>)}
    </vstack>
}

function htmlForPicture(picture: string) {
  return <hstack cornerRadius='large' height='100%' alignment='middle' grow>
          <image url={picture}
            description="cookie"
            height="100%"
            width="100%"
            resizeMode='cover'
          /></hstack>
}

const postForm = Devvit.createForm(
  (data) => {
    return {
      fields: [
        {
          type: 'string',
          name: 'title',
          label: 'Title',
          required: true,
        },
        {
          type: 'image',
          name: 'picture',
          label: 'Picture of the result',
          required: true,
        },
        {
          type: 'string',
          name: 'intro',
          label: 'One-liner intro note. (Servings / time / pre-heat temperature; Optional)',
          required: false,
        },
        {
          type: 'paragraph',
          name: 'ingredients',
          label: 'Ingredients: (One per line with measurements.)',
          required: true,
        },
        {
          type: 'paragraph',
          name: 'instructions',
          label: 'Instructions: (One step per line. Do not number.)',
          required: false,
        },
       ],
       title: 'Post a Recipe',
       acceptLabel: 'Post',
      } as const; 
    }, async ({ values }, context) => {
    const { redis, reddit, ui } = context
    const { title, picture, intro, ingredients, instructions } = values
    const response = await context.media.upload({
      url: picture,
      type: 'image',
    })
    const postId = await makeRecipePost(redis, reddit, title, response.mediaUrl, ingredients, intro ?? "", instructions ?? "" )
  }
);

Devvit.addCustomPostType({
  name: 'Experience Post',
  height: 'tall',
  render: (context) => {
    const [showInstructions, setShowInstructions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const { data, loading, error } = useAsync(async () => {
      return await context.redis.hGetAll(context.postId!);
    });
    if (loading) {
      return <text>Loading...</text>;
    }
    
    if (error) {
      return <text>Error: {error.message}</text>;
    }
    
    if (!data) {
      return <text>No data available</text>;
    }
    const postForm = useForm(
      {
        fields: [
          {
            type: 'string',
            name: 'title',
            label: 'Title',
            required: true,
          },
          {
            type: 'image',
            name: 'picture',
            label: 'Picture of the result',
            required: true,
          },
          {
            type: 'string',
            name: 'intro',
            label: 'One-liner intro note. (Servings / time / pre-heat temperature; Optional)',
            required: false,
          },
          {
            type: 'paragraph',
            name: 'ingredients',
            label: 'Ingredients: (One per line with measurements.)',
            required: true,
          },
          {
            type: 'paragraph',
            name: 'instructions',
            label: 'Instructions: (One step per line. Do not number.)',
            required: false,
          },
        ],
        title: 'Post a Recipe',
        acceptLabel: 'Post',
      }, async (values) => {
        const { redis, reddit, ui } = context
        const { title, picture, intro, ingredients, instructions } = values
        const response = await context.media.upload({
          url: picture,
          type: 'image',
        })
        const postId = await makeRecipePost(redis, reddit, title, response.mediaUrl, ingredients, intro ?? "", instructions ?? "" )
      }
    );
    const editForm = useForm(
      {
        fields: [
          {
            type: 'image',
            name: 'picture',
            label: 'New Picture (Leave blank to keep original)',
            required: false,
          },
          {
            type: 'string',
            name: 'intro',
            label: 'One-liner intro note. (Servings / time / pre-heat temperature; Optional)',
            required: false,
            defaultValue: data.intro,
          },
          {
            type: 'paragraph',
            name: 'ingredients',
            label: 'Ingredients: (One per line with measurements.)',
            required: true,
            defaultValue: data.ingredients,
          },
          {
            type: 'paragraph',
            name: 'instructions',
            label: 'Instructions: (One step per line. Do not number.)',
            required: false,
            defaultValue: data.instructions,
          },
        ],
        title: 'Edit the Recipe',
        acceptLabel: 'Update',
      }, async (values) => {
        const { redis, reddit, ui } = context
        if (values.picture != undefined) {
          const response = await context.media.upload({
            url: values.picture,
            type: 'image',
          })
          await redis.hSet(context.postId!, { title: data.title, picture: values.picture, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "" })
        } else {
          await redis.hSet(context.postId!, { title: data.title, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "" })
        }
      }
    );
    return (
      <zstack width="100%" height="100%">
        <vstack width="100%" height="100%" padding='small'>
          {/* height here in hstack will need to change based on whether the edit button appears */}
          <hstack height="100%" padding='small'>
            <vstack width="40%" alignment="middle" padding='small'>
              {formatIntro(data.intro)}
              <text style='heading' outline='thin'>Ingredients:</text>
              {formatIngredients(data.ingredients)}
              {data.instructions != "" ?
              <vstack>
                <spacer></spacer>
                <button width="93%" appearance='primary' onPress={() => setShowInstructions(!showInstructions)}>{showInstructions ? "Picture" : "Instructions"}</button>
              </vstack>
              : <vstack/> }
            </vstack>
            { showInstructions ?
            <vstack width="60%" gap="none" alignment='middle'>
              <text style='heading' outline='thin'>Directions:</text>
              {formatInstructions(data.instructions)}
            </vstack>
            :
            htmlForPicture(data!.picture)
            }
          </hstack>
        </vstack>
        {showMenu ?
        <vstack width="100%" height="100%" onPress={() => setShowMenu(false)}></vstack> :
        <vstack/> }
        <vstack>
          <button onPress={() => setShowMenu(!showMenu)} icon={showMenu ? "close" : "overflow-horizontal"}></button>
          {showMenu ?
            <vstack darkBackgroundColor='rgb(26, 40, 45)' lightBackgroundColor='rgb(234, 237, 239)' cornerRadius='medium'>
              <hstack padding="small" onPress={() => context.ui.showForm(editForm)}><spacer/><icon lightColor='black' darkColor='white' name="edit"></icon><spacer/><text lightColor='black' darkColor='white' weight="bold">Edit</text><spacer/></hstack>
              <hstack padding="small" onPress={() => context.ui.showForm(postForm)}><spacer/><icon lightColor='black' darkColor='white' name="add"></icon><spacer/><text lightColor='black' darkColor='white' weight="bold">New</text><spacer/></hstack>
              <hstack padding="small" onPress={() => console.log("Not yet implemented")}><spacer/><icon lightColor='black' darkColor='white' name="save"></icon><spacer/><text lightColor='black' darkColor='white' weight="bold">Save</text><spacer/></hstack>
              <hstack padding="small" onPress={() => console.log("Not yet implemented")}><spacer/><icon lightColor='black' darkColor='white' name="comment"></icon><spacer/><text lightColor='black' darkColor='white' weight="bold">Comment</text><spacer/></hstack>
            </vstack>
           : <vstack/> }
        </vstack>
      </zstack>
    );
  },
});

export default Devvit;
